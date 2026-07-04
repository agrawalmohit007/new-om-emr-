
import React from 'react';
import { BillData, AppPrintSettings } from '../types';
import { numberToWords } from '../services/numberToWords';

const BillPreview = React.forwardRef<HTMLDivElement, { billData: BillData, settings?: AppPrintSettings }>(({ billData, settings }, ref) => {
    const layout = settings?.bill || { marginTop: 10, marginBottom: 10, marginLeft: 10, marginRight: 10, headerHeight: 70, footerHeight: 10 };

    return (
        <div 
            ref={ref} 
            className="bg-white text-black font-mono shadow-lg w-[794px] min-h-[1123px] flex flex-col"
            style={{
                paddingTop: `${layout.marginTop}mm`,
                paddingBottom: `${layout.marginBottom}mm`,
                paddingLeft: `${layout.marginLeft}mm`,
                paddingRight: `${layout.marginRight}mm`
            }}
        >
            <header style={{ height: `${layout.headerHeight}mm` }} className="w-full flex-shrink-0">
                {/* Space reserved for letterhead */}
            </header>
            <main className="flex-grow flex flex-col">
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold">Pathology Bill / Invoice</h1>
                </div>
                <div className="flex justify-between mb-6 text-sm">
                    <div>
                        <p><span className="font-bold">Patient:</span> {billData.patientName}</p>
                        <p><span className="font-bold">Ref By:</span> {billData.refBy}</p>
                    </div>
                    <div>
                        <p><span className="font-bold">Bill No:</span> {billData.billNumber}</p>
                        <p><span className="font-bold">Date:</span> {billData.date}</p>
                    </div>
                </div>

                <table className="w-full text-sm">
                    <thead className="border-b-2 border-black">
                        <tr>
                            <th className="text-left p-2 w-12">#</th>
                            <th className="text-left p-2">Test Name</th>
                            <th className="text-right p-2 w-32">Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        {billData.items.map((item, index) => (
                            <tr key={index} className="border-b border-gray-300">
                                <td className="p-2">{index + 1}</td>
                                <td className="p-2">{item.testName}</td>
                                <td className="text-right p-2">{item.price.toFixed(2)}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot>
                        <tr className="border-t-2 border-black">
                            <td colSpan={2} className="text-right font-bold p-2 text-lg">TOTAL</td>
                            <td className="text-right font-bold p-2 text-lg">₹ {billData.total.toFixed(2)}</td>
                        </tr>
                        <tr>
                            <td colSpan={3} className="pt-2 text-xs font-semibold">
                                <span className="font-bold">Amount in Words:</span> Rupees {numberToWords(Math.floor(billData.total))} Only
                            </td>
                        </tr>
                    </tfoot>
                </table>
            </main>
            <footer className="text-center text-xs mt-auto pt-8" style={{ minHeight: `${layout.footerHeight}mm` }}>
                <p>Thank you for your visit!</p>
                {/* Placeholder for clinic address etc. */}
            </footer>
        </div>
    );
});

export default BillPreview;
