import { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ReportDesigner, type ReportDesignerHandle } from '../packages/report-engine/dist/designer.js';
import '../packages/report-engine/dist/report-engine.css';
import initial from './custom-invoice.json';
import type { ReportDocument } from '../src/types/document';
export function Example() {
  const left = useRef<ReportDesignerHandle>(null), right = useRef<ReportDesignerHandle>(null);
  const [changes,setChanges] = useState([0,0]);
  const record = (index: number) => setChanges(previous=>previous.map((v,i)=>i===index?v+1:v));
  return <div><div style={{padding:12,display:'flex',gap:16}}><button onClick={()=>{
    const document=left.current!.getDocument();document.report.name='LEFT ONLY';left.current!.setDocument(document);
  }}>Change left title</button><span data-testid="changes">Left: {changes[0]} / Right: {changes[1]}</span><button onClick={()=>alert(JSON.stringify([left.current!.getDocument().report.name,right.current!.getDocument().report.name]))}>Read both titles</button></div>
    <div id="left-designer" style={{height:650,border:'2px solid #2563eb',marginBottom:20}}><ReportDesigner ref={left} initialDocument={initial as ReportDocument} onChange={()=>record(0)} /></div>
    <div id="right-designer" style={{height:650,border:'2px solid #16a34a'}}><ReportDesigner ref={right} initialDocument={initial as ReportDocument} onChange={()=>record(1)} /></div>
  </div>;
}
createRoot(document.getElementById('root')!).render(<Example />);
