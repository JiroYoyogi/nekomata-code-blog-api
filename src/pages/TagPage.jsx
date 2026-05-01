import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import ArticleCard from '@/components/ArticleCard';
import getMeta from '@/utils/getMeta';

export default function TagPage() {
  const { tagName } = useParams();
  const decodedTagName = decodeURIComponent(tagName);
  const [articleList, setArticleList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchArticles() {
      try {
        setLoading(true);
        setError('');

        const response = await fetch(
          `/notion/v1/databases/${import.meta.env.VITE_NOTION_DATA_SOURCE_ID}/query`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${import.meta.env.VITE_NOTION_API_KEY}`,
              'Notion-Version': '2022-06-28',
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              // トップページとの差分
              filter: {
                property: 'タグ',
                multi_select: {
                  contains: decodedTagName,
                },
              },
              sorts: [{ property: '公開日', direction: 'descending' }],
            }),
          },
        );

        if (!response.ok) {
          const text = await response.text();
          throw new Error(`Notion API error: ${response.status} ${text}`);
        }

        const data = await response.json();

        const articleMetaList = (data.results || [])
          .map((page) => {
            return getMeta(page);
          })
          .filter((page) => page.isPublic);

        setArticleList(articleMetaList);
      } catch (err) {
        setError(err.message || '取得に失敗しました');
      } // try

      setLoading(false);
    } // function

    fetchArticles();
  }, [tagName]);

  if (loading)
    return (
      <p className="flex justify-center items-center h-screen">読み込み中...</p>
    );
  if (error)
    return <p className="flex justify-center items-center h-screen">{error}</p>;

  return (
    <>
      <section className="mt-12 px-6">
        <h1 className="max-w-(--max-w-content) mx-auto grid grid-cols-3 gap-x-8 gap-y-12">
          「{decodedTagName}」の記事： {articleList.length}件
        </h1>
      </section>

      <section className="mt-12 px-6">
        <ul className="max-w-(--max-w-content) mx-auto grid grid-cols-3 gap-x-8 gap-y-12">
          {articleList.map((article, key) => (
            <ArticleCard article={article} key={key} />
          ))}
        </ul>
      </section>
    </>
  );
}
