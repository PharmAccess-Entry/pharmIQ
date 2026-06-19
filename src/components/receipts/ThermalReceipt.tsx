import { renderToString } from 'react-dom/server';
import { format } from 'date-fns';
import { formatNaira } from '@/lib/format';

interface ThermalReceiptProps {
  pharmacyName: string;
  address?: string;
  phone?: string;
  shortCode: string;
  cashierName?: string;
  customerName?: string;
  items: { name: string; qty: number; price: number }[];
  total: number;
  cashGiven?: number;
}

export const ThermalReceiptTemplate = ({
  pharmacyName,
  address,
  phone,
  shortCode,
  cashierName,
  customerName,
  items,
  total,
  cashGiven
}: ThermalReceiptProps) => {
  return (
    <div style={{
      width: '80mm',
      margin: '0 auto',
      fontFamily: 'monospace, "Courier New", Courier',
      fontSize: '12px',
      lineHeight: '1.2',
      color: '#000',
      background: '#fff',
      padding: '10px'
    }}>
      <div style={{ textAlign: 'center', marginBottom: '10px' }}>
        <h2 style={{ margin: '0 0 5px 0', fontSize: '16px' }}>{pharmacyName}</h2>
        {address && <p style={{ margin: '2px 0' }}>{address}</p>}
        {phone && <p style={{ margin: '2px 0' }}>{phone}</p>}
      </div>
      
      <div style={{ borderBottom: '1px dashed #000', margin: '5px 0', paddingBottom: '5px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Tx: #{shortCode}</span>
          <span>{format(new Date(), 'dd/MM/yy HH:mm')}</span>
        </div>
        {cashierName && <div>Cashier: {cashierName}</div>}
        {customerName && <div>Customer: {customerName}</div>}
      </div>

      <table style={{ width: '100%', marginBottom: '10px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px dashed #000' }}>
            <th style={{ textAlign: 'left', padding: '3px 0' }}>Item</th>
            <th style={{ textAlign: 'right', padding: '3px 0' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '3px 0' }}>Amt</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, i) => (
            <tr key={i}>
              <td style={{ textAlign: 'left', padding: '3px 0' }}>{item.name}</td>
              <td style={{ textAlign: 'right', padding: '3px 0' }}>{item.qty}</td>
              <td style={{ textAlign: 'right', padding: '3px 0' }}>{item.price * item.qty}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #000', paddingTop: '5px', marginBottom: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px' }}>
          <span>TOTAL</span>
          <span>{formatNaira(total)}</span>
        </div>
        {cashGiven && cashGiven > 0 && (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CASH</span>
              <span>{formatNaira(cashGiven)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CHANGE</span>
              <span>{formatNaira(cashGiven - total)}</span>
            </div>
          </>
        )}
      </div>

      <div style={{ textAlign: 'center', marginTop: '15px' }}>
        <p style={{ margin: '2px 0' }}>Thank you for your patronage!</p>
        <p style={{ margin: '2px 0', fontSize: '10px' }}>Powered by PharmIQ</p>
      </div>
    </div>
  );
};

export const generateThermalHTML = (props: ThermalReceiptProps) => {
  const content = renderToString(<ThermalReceiptTemplate {...props} />);
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <title>Receipt ${props.shortCode}</title>
        <style>
          @page { margin: 0; size: 80mm auto; }
          body { margin: 0; padding: 0; }
        </style>
      </head>
      <body onload="window.print(); window.close();">
        ${content}
      </body>
    </html>
  `;
};
