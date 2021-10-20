import { laureateI, colorOption, tCategoryColor } from './types';

const colors: colorOption[] = ["neonyellow", "neongreen", "neonindigo", "neonpink", " neonred"]
export const dataToLaurates = (l: any, i: number): laureateI => {
    l.color = colors[i % (colors.length - 1)];
    return l as laureateI
}


export const categoryColor: tCategoryColor = {
    chemistry: "#87BF00",
    physics: "#FFF793",
    peace: "#C4FFFF",
    literature: "#D3762B",
    medicine: "#C3188D",
    economics: "#7325F0",
    special: "#37FF00",
}

export const getIcon = (category: string): string => {
    switch (category) {
        case "physics":
            return "ico-physics.png";
        case "peace":
            return "ico-peace.png";
        case "literature":
            return "ico-literature.png";
        case "medicine":
            return "ico-medicine.png";
        case "economics":
            return "ico-economics.png";
        case "special":
            return "ico-special.png";
        default:
            return "ico-chemistry.png"
    }
}

export const getFlag = (country: string): string => {
    switch (country) {
        case "Italy":
            return "flag-italy.png"
        case "Russian Empire (now Poland)":
            return "flag-polonia.png"
        case "USA":
            return "flag-usa.png"
        default:
            return "flag-usa.png"
    }
}