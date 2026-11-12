import GroupOrderClient from './GroupOrderClient';

export const metadata = { title: 'FoodDash — Group order' };

export default async function GroupOrderPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return <GroupOrderClient code={code.toUpperCase()} />;
}
