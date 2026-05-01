## 前提

- Node.js（動画では v24.15.0）
- AWSアカウント
- Notionアカウント

## Notionデータベースを作成

- [前回動画動画](https://youtu.be/IoeUJG1zfr0) を参考に作成
- [こちらのデータベース](https://second-plutonium-d8a.notion.site/34ed1056141180918c7aca46980dba9f?v=34ed1056141180708545000ca5986863)を自分のワークスペースに複製

## フロントのコードを準備

前回動画の最後の状態のコード

1. このリポジトリのコードをDL
1. npm install
1. 環境変数（.env.local）の設定

## 記事一覧取得関数を作成

NotionAPIはブラウザから直接叩けない。ViteのProxyサーバー → API・Lambdaでのリクエストへ変更

- 関数名：`get-notion-articles`
- ランタイム：`Node.js 24.x`

### 前回の補足

前回、NotionAPIへのリクエストの書き方が少し古いものだった（[公式のアナウンス](https://developers.notion.com/guides/get-started/upgrade-faqs-2025-09-03#how-long-will-the-2022-06-28-version-continue-to-work)）ため、最新のものに変更

```
// 旧（2022-06-28）
https://api.notion.com/v1/databases/{データベースID}/query
```

↓ 2ステップに変更

```
// 新（2026-03-11）
// 1. データソースIDを取得
https://api.notion.com/v1/databases/{データベースID}
// 2. 記事一覧を取得
https://api.notion.com/v1/data_sources/{データソースID}/query
```

### コード作成

```js
const NOTION_API_KEY = process.env.NOTION_API_KEY;
const NOTION_DATABASE_ID = process.env.NOTION_DATABASE_ID;

export const handler = async (event) => {
  try {
    if (!NOTION_API_KEY || !NOTION_DATABASE_ID) {
      throw new Error('Missing environment variables');
    }

    // ① データソースIDを取得
    const dbRes = await fetch(
      `https://api.notion.com/v1/databases/${NOTION_DATABASE_ID}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2026-03-11',
        },
      },
    );

    if (!dbRes.ok) {
      const text = await dbRes.text();
      throw new Error(`Database API error: ${dbRes.status} ${text}`);
    }

    const dbData = await dbRes.json();
    const dataSourceId = dbData.data_sources?.[0]?.id;

    if (!dataSourceId) {
      throw new Error('Data source not found');
    }

    const query = {
      sorts: [{ property: '公開日', direction: 'descending' }],
    };

    const tag = event.queryStringParameters?.tag;

    console.log(tag);

    if (tag) {
      query.filter = {
        property: 'タグ',
        multi_select: { contains: tag },
      };
    }

    // ② 記事一覧データを取得
    const res = await fetch(
      `https://api.notion.com/v1/data_sources/${dataSourceId}/query`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2026-03-11',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(query),
      },
    );

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Query API error: ${res.status} ${text}`);
    }

    const data = await res.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: message,
      }),
    };
  }
};
```

### 環境変数・タイムアウト設定

- タイムアウト：`15秒`
- 環境変数：`NOTION_DATABASE_ID`：`作成したデータベースID`
- 環境変数：`NOTION_API_KEY`：`作成したインストールのアクセストークン`

## 記事取得関数を作成

- 関数名：`get-notion-article`
- ランタイム：`Node.js 24.x`

### コード作成

```js
const NOTION_API_KEY = process.env.NOTION_API_KEY;

export const handler = async (event) => {
  try {
    if (!NOTION_API_KEY) {
      throw new Error('Missing environment variables');
    }

    const id = event.pathParameters?.id;

    if (!id) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ error: 'id is required' }),
      };
    }

    // ① メタ情報取得
    const pageRes = await fetch(`https://api.notion.com/v1/pages/${id}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${NOTION_API_KEY}`,
        'Notion-Version': '2026-03-11',
        'Content-Type': 'application/json',
      },
    });

    if (!pageRes.ok) {
      const text = await pageRes.text();
      throw new Error(`Page API error: ${pageRes.status} ${text}`);
    }

    const pageMeta = await pageRes.json();

    // ② 本文（ブロック）取得
    const blocksRes = await fetch(
      `https://api.notion.com/v1/blocks/${id}/children`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${NOTION_API_KEY}`,
          'Notion-Version': '2026-03-11',
          'Content-Type': 'application/json',
        },
      },
    );

    if (!blocksRes.ok) {
      const text = await blocksRes.text();
      throw new Error(`Blocks API error: ${blocksRes.status} ${text}`);
    }

    const pageBlocks = await blocksRes.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        meta: pageMeta,
        blocks: pageBlocks,
      }),
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Internal Server Error';

    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        error: message,
      }),
    };
  }
};
```

### 環境変数・タイムアウト設定

- タイムアウト：`15秒`
- 環境変数：`NOTION_API_KEY`：`作成したインストールのアクセストークン`

## 認証用関数を作成

- 関数名：`nekomata-code-blog-api-auth`
- ランタイム：`Node.js 24.x`

```js
export const handler = async (event) => {
  const API_KEY = process.env.AWS_API_KEY;

  // ヘッダー取得（安全に）
  const headers = event.headers || {};
  const requestApiKey =
    headers['x-api-key'] || headers['X-Api-Key'] || headers['X-API-KEY'];

  return {
    isAuthorized: requestApiKey === API_KEY,
  };
};
```

## API作成

- APIタイプを選択：`HTTP API`
- API名：`nekomata-code-api`

### ルートの作成

- GET：`/api/articles`
- GET：`/api/articles/{id}`

### 統合を作成

それぞれ「統合を作成してアタッチ」する

- /api/articles：`記事一覧取得関数を選択`
- /api/articles/{id}：`記事取得関数を選択`

### CORSを設定

- Access-Control-Allow-Origin：`*`
- Access-Control-Allow-Methods：
  - `GET`
  - `OPTIONS`
- Access-Control-Allow-Headers：
  - `content-type`
  - `x-api-key`

### オーソライザーを作成

「Authorization」→「オーソライザーを管理」タブ→「作成」

- オーソライザーのタイプ：`Lambda`
- 名前：`nekomata-code-blog-api-auth`
- AWSリージョン：`ap-northeast-1`
- Lambda関数：`作成した認証用関数`
- ID ソース：`$request.header.x-api-key`

## AWS SAMのテンプレート紹介

【差分】

- [Notion SDK](https://makenotion-notion-sdk-js.mintlify.app/introduction)でAPIリクエスト
- JS → TS

【手順】

- [こちらのリポジトリ](https://github.com/JiroYoyogi/nekomata-code-blog-api-sam)でコードをDL
- `src/`に移動して`npm install`
- `cd ..`でプロジェクト直下に戻る
- `sam build`
- `sam deploy --guided`

【デプロイ時の設定】

```
Stack Name：nekomata-code-blog-api
AWS Region：ap-northeast-1
Stage：dev （stgやprdなどでもOK）
NotionDatabaseId：該当のNotionデータベースID
NotionApiKey：作成したアクセストークン
AwsApiKey：nekomata-code
```

## フロントからAPIGWにリクエストする

### 環境変数を追加

- .env.local

下記で置き換える（VITE_NOTION_API_KEYとVITE_NOTION_DATA_SOURCE_IDは以降不要）

```
VITE_AWS_API_KEY=nekomata-code
VITE_AWS_API_DOMAIN=作成したAPIGWのドメイン
```

- HomePage.jsx

APIリクエストを下記に置き換える

```jsx
const API_DOMAIN = import.meta.env.VITE_AWS_API_DOMAIN;

// 1度に100件まで
const response = await fetch(`${API_DOMAIN}/api/articles`, {
  headers: {
    'x-api-key': import.meta.env.VITE_AWS_API_KEY,
  },
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`Notion API error: ${response.status} ${text}`);
}

const data = await response.json();
```

- TagPage.jsx

APIリクエストを下記に置き換える

```jsx
const API_DOMAIN = import.meta.env.VITE_AWS_API_DOMAIN;

const response = await fetch(`${API_DOMAIN}/api/articles?tag=${tagName}`, {
  headers: {
    'x-api-key': import.meta.env.VITE_AWS_API_KEY,
  },
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`Notion API error: ${response.status} ${text}`);
}

const data = await response.json();
```

- ArticlePage.jsx

APIリクエストを下記に置き換える

```jsx
const API_DOMAIN = import.meta.env.VITE_AWS_API_DOMAIN;

// 1度に100件まで
const response = await fetch(`${API_DOMAIN}/api/articles/${id}`, {
  headers: {
    'x-api-key': import.meta.env.VITE_AWS_API_KEY,
  },
});

if (!response.ok) {
  const text = await response.text();
  throw new Error(`Notion API error: ${response.status} ${text}`);
}

const pageData = await response.json();

const pageMeta = pageData.meta;
// カード作成時にメタデータを取得した処理と同じでいける
const { title, tags, writer, date, coverImageUrl } = getMeta(pageMeta);

const pageBlocks = pageData.blocks.results ?? [];
```

## S3 + CloudFrontで配信する

### バケットを作成

- バケット名：`nekomata-code-blog`

### ソースをアップロード

1. コードをビルド

```
npm run build
```

2. `dist/`のファイルをS3にアップロード

### ディストリビューションを作成

- Choose a plan：`Pay as you go`

```
- 無料（月100万リクエストまで無料。毎日1人3ページ閲覧で約1800ユーザーまで）
- Pro（月1000万リクエストまで無料。毎日1人3ページ閲覧で約1.8万ユーザーまで）

どれをを選択しても同じ設定画面に進む。無料プラン・ProプランはWAF（IP制限機能・DDoS対策など）が無料で付く。
しかし、削除手順が煩雑（月末まで削除出来ない・WebACLを手動で削除）。お試しなら「Pay as you go」が迷わない。

```

- Distribution name：`nekomata-code-blog`
- Distribution type：`Single website or app`
- Origin type：`Amazon S3`
- S3 origin：`上記で作成したバケットを選択`
- Origin path：`空でOK`
- Web Application Firewall (WAF) ：`セキュリティ保護を有効にしないでください`

### SPA対策

#### ページが上手く表示されない問題

```
https://ドメイン/index.html
```

#### CloudFront Functionsを作成

- 名前

```
nekomata-code-blog-routing
```

- 関数コード

下記で置き換えたら「変更を保存」する

```js
function handler(event) {
  var request = event.request;
  var uri = request.uri;

  // 静的アセット（.js, .css, .png等）はそのまま通す
  if (uri.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$/)) {
    return request;
  }

  // その他はindex.htmlにリライト
  if (uri.endsWith('/') || !uri.includes('.')) {
    request.uri = '/index.html';
  }

  return request;
}
```

- 関数を発行
- 関連付けられているディストリビューション

```
- ディストリビューション：作成したCloudFront
- イベントタイプ：Viewer request
- キャッシュビヘイビア：Default（*）
```

## APIキーを隠す

### オリジンを追加

「オリジン」タブで「オリジンを作成」

- Origin domain：`作成したAPIを選択`
- Origin path - optional：`/api`
- カスタムヘッダーを追加

```
- ヘッダー名：x-api-key
- 値：nekomata-code
```

### ビヘイビアを追加

「ビヘイビア」タブで「ビヘイビアを作成」

- パスパターン：`/api/*`
- オリジンとオリジングループ：`作成したAPIを選択`

### ReactからのAPIリクエストのパスを変更

- `/api（ドメイン無し）`でリクエスト出来るようにしたい
- APIキーをリクエストから削除したい

#### /api（ドメイン無し）でリクエスト出来るようにしたい

- vite.config.js

プロキシの設定を追加。本番では`/api`、ローカル開発環境からも`/api`だがプロキシ経由のAPIリクエストになる。APIキーについては、本番ではCloudFrontの設定で付与が不要。しかし、ローカル開発環境でアプリを立ち上げる場合には、付与したい。

```js
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd());

  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    server: {
      proxy: {
        '/notion': {
          target: 'https://api.notion.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/notion/, ''),
        },
        '/api': {
          target: env.VITE_AWS_API_DOMAIN,
          changeOrigin: true,
          headers: {
            'x-api-key': env.VITE_AWS_API_KEY,
          },
        },
      },
    },
  };
});
```

- HomePage.jsx

```jsx
const response = await fetch('/api/articles');
```

- TagPage.jsx

```jsx
const response = await fetch(`/api/articles?tag=${tagName}`);
```

- ArticlePage.jsx

```jsx
const response = await fetch(`/api/articles/${id}`);
```

#### ビルドしてS3のコードを置き換える

```
npm run build
```

CloudFrontのキャッシュを削除（`/*`）した上でAPIキーが隠せたことを確認

## CloudFrontの削除方法（無料含めてプランで作成した場合）

「Pay as you go」以外は即削除が出来ないので注意

- まず「無効」にする
- 「Manage Plan」で「プランをキャンセル」する
- 月末まで削除出来ない問題（※CFを無効にすれば放置しても課金は無い）
- 翌月「Pay as you go」に切り替わったタイミングで削除（※無効にすれば放置しても課金は無い）
- Web ACLを必ず削除！！！放っておくと毎月$10ぐらいかかる（※月の途中で削除した場合は按分）
