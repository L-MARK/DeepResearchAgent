import { FormEvent, useState } from "react";

export function ClarificationCard({ onSubmit }: {onSubmit: (content: string) => Promise<void>}) {
  const [value, setValue] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); if (!value.trim()) return; setBusy(true); try { await onSubmit(value.trim()); setValue(""); } finally { setBusy(false); } }
  return <form className="clarification-card" onSubmit={submit}><strong>需要你的补充信息</strong><p>请补充主体、范围或时间条件，系统将继续当前 Run。</p><div><input value={value} onChange={(event) => setValue(event.target.value)} placeholder="输入澄清信息" /><button disabled={busy}>继续运行</button></div></form>;
}
