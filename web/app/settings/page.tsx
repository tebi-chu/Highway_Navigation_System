/* eslint-disable @next/next/no-html-link-for-pages */
import { requireAdmin } from '@/lib/admin';
import { pinStatus } from '@/lib/pin';
import SettingsPanel from './settings-panel';

export const dynamic='force-dynamic';
export default async function Settings({searchParams}:{searchParams:Promise<{error?:string}>}){
 const admin=await requireAdmin(); const query=await searchParams;
 if(!admin)return <main className="settings-shell"><section className="settings-card auth-card"><div className="pin-brand"><span>⚙</span><div><b>管理設定</b><small>HIGHWAY ASSIST</small></div></div><p className="eyebrow">ADMIN ONLY</p><h1>Googleアカウントで認証</h1><p className="intro">許可された管理者アカウントだけがPIN設定を変更できます。</p>{query.error&&<p className="form-error">{query.error==='denied'?'このGoogleアカウントには管理権限がありません。':'Google認証を完了できませんでした。'}</p>}<a className="google-button" href="/api/admin/google/start"><span>G</span>Googleでログイン</a><a className="back-link" href="/">PIN入力へ戻る</a></section></main>;
 return <SettingsPanel email={admin.email} initialConfigured={(await pinStatus()).configured}/>;
}
