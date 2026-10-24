import type { DataFieldSchema } from '../types/datasource';
import type { ReportDefinition } from '../types/report';

export function createDefaultSubReportDefinition(title = '序號與檢驗明細'): ReportDefinition {
  return {
    id: `subreport-${Date.now()}`,
    name: title,
    pageSettings: {
      size: 'A4',
      orientation: 'portrait',
      margins: { top: 0, right: 0, bottom: 0, left: 0 },
    },
    bands: [
      {
        id: 'sub-band-header',
        type: 'PageHeader',
        height: 16,
        controls: [
          {
            id: 'sub-th-sn',
            type: 'Label',
            x: 4,
            y: 0,
            width: 105,
            height: 16,
            text: '出廠序號 (S/N)',
            style: { fontSize: 7, fontWeight: 'bold', color: '#475569', backgroundColor: '#f1f5f9', borderBottomWidth: 0.5, borderColor: '#cbd5e1', paddingVertical: 2 },
          },
          {
            id: 'sub-th-barcode',
            type: 'Label',
            x: 112,
            y: 0,
            width: 110,
            height: 16,
            text: '序號條碼 (CODE128)',
            style: { fontSize: 7, fontWeight: 'bold', color: '#475569', backgroundColor: '#f1f5f9', borderBottomWidth: 0.5, borderColor: '#cbd5e1', paddingVertical: 2 },
          },
          {
            id: 'sub-th-lot',
            type: 'Label',
            x: 226,
            y: 0,
            width: 85,
            height: 16,
            text: '生產批號',
            style: { fontSize: 7, fontWeight: 'bold', color: '#475569', backgroundColor: '#f1f5f9', borderBottomWidth: 0.5, borderColor: '#cbd5e1', paddingVertical: 2 },
          },
          {
            id: 'sub-th-location',
            type: 'Label',
            x: 315,
            y: 0,
            width: 75,
            height: 16,
            text: '出貨儲位',
            style: { fontSize: 7, fontWeight: 'bold', color: '#475569', backgroundColor: '#f1f5f9', borderBottomWidth: 0.5, borderColor: '#cbd5e1', paddingVertical: 2 },
          },
          {
            id: 'sub-th-qc',
            type: 'Label',
            x: 395,
            y: 0,
            width: 75,
            height: 16,
            text: '品檢結果',
            style: { fontSize: 7, fontWeight: 'bold', textAlign: 'right', color: '#475569', backgroundColor: '#f1f5f9', borderBottomWidth: 0.5, borderColor: '#cbd5e1', paddingVertical: 2, paddingHorizontal: 6 },
          },
        ],
      },
      {
        id: 'sub-band-detail',
        type: 'Detail',
        height: 22,
        controls: [
          {
            id: 'sub-td-sn',
            type: 'Field',
            x: 4,
            y: 2,
            width: 105,
            height: 18,
            fieldName: 'serialNo',
            style: { fontSize: 7, color: '#0f172a' },
          },
          {
            id: 'sub-td-barcode',
            type: 'Barcode',
            x: 112,
            y: 1,
            width: 110,
            height: 19,
            fieldName: 'serialNo',
            barcodeFormat: 'CODE128',
            displayValue: false,
          },
          {
            id: 'sub-td-lot',
            type: 'Field',
            x: 226,
            y: 2,
            width: 85,
            height: 18,
            fieldName: 'lotNo',
            style: { fontSize: 7, color: '#475569' },
          },
          {
            id: 'sub-td-location',
            type: 'Field',
            x: 315,
            y: 2,
            width: 75,
            height: 18,
            fieldName: 'location',
            style: { fontSize: 7, color: '#475569' },
          },
          {
            id: 'sub-td-qc',
            type: 'Field',
            x: 395,
            y: 2,
            width: 75,
            height: 18,
            fieldName: 'qcStatus',
            style: { fontSize: 7, fontWeight: 'bold', color: '#059669', textAlign: 'right', paddingHorizontal: 6 },
          },
        ],
      },
    ],
  };
}

/** Generates a child table from declared fields, including for an empty dataset. */
export function createSubReportForFields(title: string, fields: DataFieldSchema[], width = 480): ReportDefinition {
  const columns=fields.filter(field=>field.type!=='array');
  const columnWidth=columns.length ? Math.max(1,width)/columns.length : 0;
  const geometry=(index: number)=>({x:index*columnWidth,y:0,width:columnWidth,height:20});
  return {
    id:'subreport-'+crypto.randomUUID(), name:title,
    pageSettings:{size:'A4',orientation:'portrait',margins:{top:0,right:0,bottom:0,left:0}},
    bands:[
      {id:'header-'+crypto.randomUUID(),type:'PageHeader',height:20,controls:columns.map((field,index)=>({id:'th-'+crypto.randomUUID(),type:'Label',...geometry(index),text:field.label,style:{fontSize:8,backgroundColor:'#f1f5f9'}}))},
      {id:'detail-'+crypto.randomUUID(),type:'Detail',height:20,controls:columns.map((field,index)=>({id:'td-'+crypto.randomUUID(),type:'Field',...geometry(index),fieldName:field.name,formatString:field.formatHint,style:{fontSize:8}}))},
    ],
  };
}
