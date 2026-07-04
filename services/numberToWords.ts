const a = ['', 'one ', 'two ', 'three ', 'four ', 'five ', 'six ', 'seven ', 'eight ', 'nine ', 'ten ', 'eleven ', 'twelve ', 'thirteen ', 'fourteen ', 'fifteen ', 'sixteen ', 'seventeen ', 'eighteen ', 'nineteen '];
const b = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

const capitalize = (s: string): string => {
    if (typeof s !== 'string' || s.length === 0) return '';
    return s.charAt(0).toUpperCase() + s.slice(1);
}

export function numberToWords(num: number): string {
    const n = Math.floor(num);
    if (n === 0) return 'Zero';
    if (n > 999999999) return 'Number too large';

    const numStr = ('000000000' + n).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!numStr) return '';

    let str = '';
    str += (Number(numStr[1]) !== 0) ? (a[Number(numStr[1])] || b[numStr[1][0]] + ' ' + a[numStr[1][1]]) + 'crore ' : '';
    str += (Number(numStr[2]) !== 0) ? (a[Number(numStr[2])] || b[numStr[2][0]] + ' ' + a[numStr[2][1]]) + 'lakh ' : '';
    str += (Number(numStr[3]) !== 0) ? (a[Number(numStr[3])] || b[numStr[3][0]] + ' ' + a[numStr[3][1]]) + 'thousand ' : '';
    str += (Number(numStr[4]) !== 0) ? (a[Number(numStr[4])] || b[numStr[4][0]] + ' ' + a[numStr[4][1]]) + 'hundred ' : '';
    str += (Number(numStr[5]) !== 0) ? ((str !== '') ? 'and ' : '') + (a[Number(numStr[5])] || b[numStr[5][0]] + ' ' + a[numStr[5][1]]) : '';
    
    return capitalize(str.trim().replace(/\s+/g, ' '));
}
