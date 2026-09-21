import Portfolio from "./portfolio";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ id?: string }>;
}) {
  const { id } = await searchParams;
  return <Portfolio id={id ?? ""} />;
}
