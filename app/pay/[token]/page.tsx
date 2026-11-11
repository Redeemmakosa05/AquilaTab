import Guest from "@/app/guest";
export default async function Page({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return <Guest kind="pay" id={(await params).token} />;
}
