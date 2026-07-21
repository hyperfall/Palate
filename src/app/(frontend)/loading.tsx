import { CookingLoader } from '@/components/CookingLoader'

/** Site-wide loading fallback — the simmering pot while a page plates up. */
export default function Loading() {
  return <CookingLoader label="Firing up" size={56} center />
}
