import { useState, useCallback } from 'react';
import { db, PrintJob } from '../offline/db';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'sonner';

export const usePrintService = () => {
  const [isPrinting, setIsPrinting] = useState(false);

  // Queue a print job
  const queuePrintJob = async (restaurant_id: string, job_type: PrintJob['job_type'], payload: any) => {
    const job: PrintJob = {
      id: uuidv4(),
      restaurant_id,
      job_type,
      payload,
      status: 'pending',
      created_at: Date.now(),
      attempts: 0
    };
    await db.print_queue.add(job);
    return job.id;
  };

  // Browser standard printing (A4 or system configured thermal)
  const browserPrint = (htmlContent: string) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('Pop-up blocked. Please allow pop-ups to print.');
      return false;
    }
    
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    
    // Give it a moment to load styles before triggering print
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
    
    return true;
  };

  // WebUSB/Thermal direct printing placeholder
  // A complete thermal implementation requires standard ESC/POS commands
  const thermalPrint = async (payload: any) => {
    try {
      if (!navigator.usb) {
        throw new Error('WebUSB not supported in this browser.');
      }
      // Usually requires: const device = await navigator.usb.requestDevice({ filters: [{ vendorId: 0x04b8 }] });
      // We will fallback to browser print with a specialized thermal CSS template for now,
      // as raw hardware interaction requires explicit user pairing per device.
      console.log('Thermal print requested for:', payload);
      toast.info('Direct thermal print is experimental. Using browser print fallback.');
      return false; // returning false triggers fallback
    } catch (err: any) {
      console.error('Thermal print error:', err);
      return false;
    }
  };

  // Process the queue
  const processPrintQueue = useCallback(async () => {
    if (isPrinting) return;
    setIsPrinting(true);

    const pendingJobs = await db.print_queue
      .where('status')
      .equals('pending')
      .toArray();

    for (const job of pendingJobs) {
      await db.print_queue.update(job.id, { attempts: job.attempts + 1 });
      
      try {
        let success = false;
        
        // Attempt thermal direct if configured, otherwise fallback to browser print
        // Assuming we always fallback to browserPrint for the receipt html string in this implementation
        if (job.job_type === 'RECEIPT') {
           success = browserPrint(job.payload.htmlContent);
        }

        if (success) {
          await db.print_queue.update(job.id, { status: 'printed' });
        } else {
          await db.print_queue.update(job.id, { status: 'failed' });
        }
      } catch (err) {
        console.error('Print job failed', err);
        await db.print_queue.update(job.id, { status: 'failed' });
      }
    }

    setIsPrinting(false);
  }, [isPrinting]);

  return { queuePrintJob, processPrintQueue, isPrinting };
};
