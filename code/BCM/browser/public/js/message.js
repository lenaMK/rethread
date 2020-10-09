const challenges = [
    {
        se: "🌍 Kan du ansluta till en webbsida som aktiveras på kartan Afrika, Ryssland eller Sverige?",
        en: "Can you connect to a webpage that activates in the map Africa, Russia, or Sweden?"
    },
    {
        se: "🟠 Kan du hitta en webbsida som bara visar en enda röd punkt?",
        en: "Can you find a website that shows only one red dot?"
    },
    {
        se: "🔎 Hitta en webbplats med så många punkter som möjligt!",
        en: "Find a website that activates as many dots as possible!"
    },
    {
        se: "🎵 Hitta en webbplats med så mycket ljud som möjligt!",
        en: "Find a website with as much sound as possible!"
    },
    {
        se: "🤔 Besök din favoritwebbplats. Hur många andra sidor besöker du på samma gång?",
        en: "Visit your favorite website. How many other websites do you visit at the same time?"
    },
]

let challengePos = 0;
const sendChallenge = 5000;
const challengeTime = Date.now();
const clicks = 0;

function getChallenge() {
    challengePos = challengePos + 1 >= challenges.length ? 0 : challengePos + 1;
    typeMessage(challenges[challengePos])
}





const captionEl = document.getElementById("message-se"), //Header element
    eParagraph = document.getElementById("message-en"); //Subheader element

let captionLength = 0;
let captionLength_en = 0;
let caption_se = '';
let caption_en = '';

const speed = 100;

let erasetimeout;
let typeTiemout;

function typeMessage(message) {
    caption_se = message.se;
    caption_en = message.en;
    captionLength = 0;
    captionLength_en = 0;
    clearTimeout(erasetimeout);
    type();
}

function type() {
    captionEl.innerHTML = caption_se.substr(0, captionLength++);
    eParagraph.innerHTML = caption_en.substr(0, captionLength_en++);
    if (captionLength < caption_se.length + 1 && captionLength_en < caption_en.length + 1) {
        typeTiemout = setTimeout('type()', speed);
    } else {
        clearTimeout(typeTiemout);
        erasetimeout = setTimeout(() => { erase(); }, 4000);

    }
}



function erase() {
    captionEl.innerHTML = caption_se.substr(0, captionLength--);
    eParagraph.innerHTML = caption_en.substr(0, captionLength_en--);
    if (captionLength >= 0 && captionLength_en >= 0) {
        erasetimeout = setTimeout('erase()', speed);
    } else {
        clearTimeout(typeTiemout);
        clearTimeout(erasetimeout);
        captionLength = 0;
        caption_se = '';
        captionLength_en = 0;
        caption_en = '';
    }
}


// const message = {
//     se: "Det äar en experiment för alt",
//     en: "This is an experimetn for all"
// }
// typeMessage(message)

setInterval(getChallenge, 30000);

