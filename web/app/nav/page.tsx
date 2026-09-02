import { redirect } from 'next/navigation';
import { readSession } from '@/lib/cookies';
import Navigator from './navigator';
export const dynamic='force-dynamic';
export default async function Nav(){if(!await readSession('pin'))redirect('/');return <Navigator/>}
