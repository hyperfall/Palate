'use client'

import { useState } from 'react'

import { BUDGET_RANGES, validatePartnerRequest } from '@/lib/partners'
import { Select } from '@/components/controls'

const inputCls =
  'w-full rounded border border-rule bg-transparent px-3 py-2.5 font-body text-[1rem] text-ink placeholder:text-slate/60 focus:border-flame focus:outline-none'
const labelCls = 'grid gap-1.5'

/**
 * The advertise-with-us request form. Client-validated with the same
 * `validatePartnerRequest` the server route enforces, so the two can't drift.
 * Country targets are typed as a loose comma list and split to ISO codes.
 */
export function PartnerRequestForm() {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ kind: 'error' | 'ok'; text: string } | null>(null)

  const [company, setCompany] = useState('')
  const [website, setWebsite] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [promoting, setPromoting] = useState('')
  const [regions, setRegions] = useState('')
  const [budgetRange, setBudgetRange] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setNotice(null)

    const payload = {
      company,
      website,
      contactName,
      contactEmail,
      promoting,
      targetRegions: regions
        .split(/[,\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      budgetRange: budgetRange || undefined,
      message: message || undefined,
    }

    const error = validatePartnerRequest(payload)
    if (error) {
      setNotice({ kind: 'error', text: error })
      return
    }

    setBusy(true)
    try {
      const res = await fetch('/partners/apply', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not send your request.')
      setNotice({
        kind: 'ok',
        text: 'Request received. We’ll review it and get back to you by email.',
      })
      setCompany('')
      setWebsite('')
      setContactName('')
      setContactEmail('')
      setPromoting('')
      setRegions('')
      setBudgetRange('')
      setMessage('')
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Couldn’t send that. Try again in a moment.' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelCls}>
          <span className="eyebrow">Company / brand</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)} required className={inputCls} />
        </label>
        <label className={labelCls}>
          <span className="eyebrow">Website</span>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            inputMode="url"
            placeholder="https://"
            required
            className={inputCls}
          />
        </label>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelCls}>
          <span className="eyebrow">Contact name</span>
          <input value={contactName} onChange={(e) => setContactName(e.target.value)} required className={inputCls} />
        </label>
        <label className={labelCls}>
          <span className="eyebrow">Contact email</span>
          <input
            value={contactEmail}
            onChange={(e) => setContactEmail(e.target.value)}
            type="email"
            required
            className={inputCls}
          />
        </label>
      </div>

      <label className={labelCls}>
        <span className="eyebrow">What would you like to promote?</span>
        <textarea
          value={promoting}
          onChange={(e) => setPromoting(e.target.value)}
          rows={3}
          required
          placeholder="Product, brand, or category, and which cuisines or recipes feel like a fit."
          className={`${inputCls} resize-y`}
        />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className={labelCls}>
          <span className="eyebrow">Target countries (optional)</span>
          <input
            value={regions}
            onChange={(e) => setRegions(e.target.value)}
            placeholder="US, GB, KR. Leave blank for global"
            className={inputCls}
          />
        </label>
        <label className={labelCls}>
          <span className="eyebrow">Monthly budget (optional)</span>
          <Select value={budgetRange} onChange={setBudgetRange} ariaLabel="Monthly budget">
            <option value="">Prefer not to say</option>
            {BUDGET_RANGES.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </Select>
        </label>
      </div>

      <label className={labelCls}>
        <span className="eyebrow">Anything else (optional)</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={3}
          className={`${inputCls} resize-y`}
        />
      </label>

      {notice && (
        <p
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`m-0 text-note ${notice.kind === 'error' ? 'text-heat' : 'text-richness'}`}
        >
          {notice.text}
        </p>
      )}

      <button type="submit" disabled={busy} className="btn-primary justify-self-start disabled:opacity-60">
        {busy ? 'Sending…' : 'Send request'}
      </button>
    </form>
  )
}
