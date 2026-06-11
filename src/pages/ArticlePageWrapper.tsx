import ArticlePage from './ArticlePage';

export default function ArticlePageWrapper({ slug }: { slug: string }) {
  return <ArticlePage slug={slug} />;
}
