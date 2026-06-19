import { db } from './db';
import { v4 as uuidv4 } from 'uuid';

export async function generateAndSaveOfflineReceipt(restaurant_id: string, short_code: string, htmlContent: string) {
  const receiptId = uuidv4();
  await db.receipts.add({
    id: receiptId,
    restaurant_id,
    short_code,
    html_content: htmlContent,
    created_at: Date.now()
  });
  return receiptId;
}

export async function printOfflineReceipt(receiptId: string) {
  const receipt = await db.receipts.get(receiptId);
  if (!receipt) {
    console.error("Receipt not found");
    return;
  }
  
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.write(receipt.html_content);
    printWindow.document.close();
    printWindow.focus();
    // Use a timeout to ensure styles load
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }
}
