import { redirect } from 'next/navigation';
import { readSession } from '@/lib/cookies';
import { pinStatus } from '@/lib/pin';
import PinLogin from './pin-login';

export const dynamic='force-dynamic';
export default async function Home(){
  if(await readSession('pin'))redirect('/nav');
  const status=await pinStatus();
  return <PinLogin configured={status.configured}/>;
}
