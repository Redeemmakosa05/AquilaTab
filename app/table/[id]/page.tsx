import Guest from '@/app/guest';
export default async function Page({params}:{params:Promise<{id:string}>}){return <Guest kind="table" id={(await params).id}/>}
