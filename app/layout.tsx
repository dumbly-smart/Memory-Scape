import type { Metadata } from 'next';
import './globals.css';
import 'leaflet/dist/leaflet.css';
import { Shell } from '@/components/Shell';
export const metadata:Metadata={title:'MemoryScape · Personal Knowledge Graph',description:'A spatiotemporal personal knowledge graph with biologically inspired recall.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><Shell>{children}</Shell></body></html>}
