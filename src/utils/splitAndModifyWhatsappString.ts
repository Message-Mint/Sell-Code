export function splitAndModifyWhatsappString(inputString: string, onlyNumber: boolean = false): string {
    if (inputString.includes(':') || inputString.includes('@')) {
        const parts = inputString.split(':');
        const numberPart = parts[0];
        const domainPart = parts[1].split('@')[1];

        if (onlyNumber) {
            return numberPart;
        }

        const modifiedString = `${numberPart}@${domainPart}`;
        return modifiedString;
    } else {
        return "Invalid format";
    }
}
