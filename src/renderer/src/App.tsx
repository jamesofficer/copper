import { useState } from 'react'
import type { PullRequest } from '../../shared/types'
import Welcome from './screens/Welcome'
import Review from './screens/Review'

export default function App() {
  const [selected, setSelected] = useState<PullRequest | null>(null)

  if (selected) {
    return <Review pr={selected} onBack={() => setSelected(null)} />
  }

  return <Welcome onSelect={setSelected} />
}
