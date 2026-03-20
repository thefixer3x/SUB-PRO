import Papa from 'papaparse';
import ExcelJS from 'exceljs';

export interface ParsedData {
  headers: string[];
  rows: any[][];
  totalRows: number;
}

export interface ParseError {
  message: string;
  row?: number;
  field?: string;
}

export const parseCSVFile = (file: File): Promise<ParsedData> => {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: false,
      skipEmptyLines: true,
      complete: (results: { errors: Array<{ message: string }>; data: unknown }) => {
        if (results.errors.length > 0) {
          reject(new Error(`CSV parsing error: ${results.errors[0].message}`));
          return;
        }

        const data = results.data as string[][];
        if (data.length === 0) {
          reject(new Error('File is empty'));
          return;
        }

        const headers = data[0];
        const rows = data.slice(1);

        resolve({
          headers,
          rows,
          totalRows: rows.length,
        });
      },
      error: (error: { message: string }) => {
        reject(new Error(`Failed to parse CSV: ${error.message}`));
      },
    });
  });
};

export const parseExcelFile = (file: File): Promise<ParsedData> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(buffer);
        
        // Get first worksheet
        const worksheet = workbook.worksheets[0];
        if (!worksheet) {
          reject(new Error('No worksheets found in Excel file'));
          return;
        }

        const rows: any[][] = [];
        worksheet.eachRow((row: { values?: unknown }) => {
          const rowValues = row.values;
          rows.push(Array.isArray(rowValues) ? rowValues.slice(1) : []);
        });
        
        if (rows.length === 0) {
          reject(new Error('File is empty'));
          return;
        }

        const headers = rows[0] as string[];
        const dataRows = rows.slice(1) as any[][];

        resolve({
          headers,
          rows: dataRows,
          totalRows: dataRows.length,
        });
      } catch (error) {
        reject(new Error(`Failed to parse Excel file: ${error instanceof Error ? error.message : 'Unknown error'}`));
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsArrayBuffer(file);
  });
};

export const parseFile = async (file: File): Promise<ParsedData> => {
  const fileExtension = file.name.split('.').pop()?.toLowerCase();
  
  switch (fileExtension) {
    case 'csv':
      return parseCSVFile(file);
    case 'xlsx':
    case 'xls':
      return parseExcelFile(file);
    default:
      throw new Error('Unsupported file format. Please use CSV or Excel (.xlsx) files.');
  }
};
