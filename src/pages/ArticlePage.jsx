import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import formatDate from '@/utils/formatDate';
import Tag from '@/components/Tag';
import getMeta from '@/utils/getMeta';
import blocksToMarkdown from '@/utils/blocksToMarkdown';
import DOMPurify from 'isomorphic-dompurify';
import { marked } from 'marked';

export default function ArticlePage() {
  const { id } = useParams();

  const [article, setArticle] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchArticle() {
      try {
        setLoading(true);
        setError('');
        // a. 記事メタデータ（タイトルやライターなど）を取得するリクエスト
        const pageMetaRes = await fetch(`/notion/v1/pages/${id}`, {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28',
          },
        });

        if (!pageMetaRes.ok) {
          const text = await pageMetaRes.text();
          throw new Error(`Notion API error: ${pageMetaRes.status} ${text}`);
        }

        const pageMeta = await pageMetaRes.json();
        // カード作成時にメタデータを取得した処理と同じでいける
        const { title, tags, writer, date, coverImageUrl } = getMeta(pageMeta);

        // b. 記事本文データを取得するリクエスト
        const pageBlocksRes = await fetch(`/notion/v1/blocks/${id}/children`, {
          headers: {
            Authorization: `Bearer ${import.meta.env.VITE_NOTION_API_KEY}`,
            'Notion-Version': '2022-06-28',
          },
        });

        if (!pageBlocksRes.ok) {
          const text = await pageBlocksRes.text();
          throw new Error(`Notion API error: ${pageBlocksRes.status} ${text}`);
        }

        const pageBlocks = await pageBlocksRes.json();

        const markdown = blocksToMarkdown(pageBlocks.results);
        const bodyParsed = await marked.parse(markdown);
        // HTMLをサニタイズ
        const content = DOMPurify.sanitize(bodyParsed);

        setArticle({
          id,
          title,
          tags,
          writer,
          date,
          coverImageUrl,
          content,
        });
      } catch (err) {
        setError(err.message || '取得に失敗しました');
      }
      setLoading(false);
    }

    fetchArticle();
  }, [id]);

  if (loading)
    return (
      <p className="flex justify-center items-center h-screen">読み込み中...</p>
    );
  if (error)
    return <p className="flex justify-center items-center h-screen">{error}</p>;

  return (
    <div className="mt-12 px-6">
      <div className="max-w-(--max-w-content) mx-auto bg-white px-10 md:px-20 lg:px-35 pt-10 pb-16 rounded-xl">
        {article.coverImageUrl && (
          <img
            src={article.coverImageUrl}
            alt=""
            width="640"
            className="mx-auto rounded-lg w-full"
          />
        )}

        <h1 className="text-xl mt-8">{article.title}</h1>

        <div className="flex items-center justify-between text-sm mt-6">
          <div className="flex gap-3">
            <span>{formatDate(article.date)}</span>
            <span className="font-bold">{article.writer}</span>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 mt-6">
          {article.tags.map((tag) => (
            <Tag label={tag} key={tag} variant="article" />
          ))}
        </div>
        <article
          className="prose mt-8 max-w-none"
          dangerouslySetInnerHTML={{ __html: article.content }}
        />
      </div>
    </div>
  );
}
