'use client';

import dynamic from 'next/dynamic';

const SpatiotemporalWalk = dynamic(
  () => import('@/components/SpatiotemporalWalk').then(module => module.SpatiotemporalWalk),
  { ssr: false, loading: () => <div className="empty">Loading spatiotemporal recall map…</div> },
);

export default function Page() {
  return <SpatiotemporalWalk/>;
}
