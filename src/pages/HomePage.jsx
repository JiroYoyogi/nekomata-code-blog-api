import { useEffect, useState } from 'react';
import ArticleCard from '@/components/ArticleCard';
import Tag from '@/components/Tag';
import getMeta from '@/utils/getMeta';

export default function HomePage() {
  const [articleList, setArticleList] = useState([]);
  const [tagList, setTagList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchArticles() {
      try {
        setLoading(true);
        setError('');

        // 1度に100件まで
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

        const tags = new Set();

        articleMetaList.forEach((article) => {
          article.tags.forEach((tag) => {
            tags.add(tag);
          });
        });

        setTagList([...tags]);
        setArticleList(articleMetaList);
      } catch (err) {
        setError(err.message || '取得に失敗しました');
      }
      setLoading(false);
    }

    fetchArticles();
  }, []);

  if (loading)
    return (
      <p className="flex justify-center items-center h-screen">読み込み中...</p>
    );
  if (error)
    return <p className="flex justify-center items-center h-screen">{error}</p>;

  return (
    <>
      {/* タグ一覧 */}
      <section className="mt-12 px-6">
        <ul className="max-w-(--max-w-content) mx-auto flex flex-wrap gap-3">
          {tagList.map((tag, key) => (
            <Tag key={key} variant="list" label={tag} />
          ))}
        </ul>
      </section>
      {/* 記事一覧 */}
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
