import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useHistory } from "react-router-dom";
import { v4 as uuidv4 } from 'uuid';
import {
    IconLookup,
    IconDefinition,
    findIconDefinition
} from '@fortawesome/fontawesome-svg-core';

import { InfoCard } from "./infoCard";
import { CharacterCard } from "./characterCard";

import { laureateI, selectCharacterProps, prize } from "../types";
import { categoryColor } from "../utils";

import SwiperCore, { Navigation, Pagination } from "swiper";
import { Swiper, SwiperSlide } from "swiper/react";

// Import Swiper styles
import 'swiper/swiper.min.css';

SwiperCore.use([Navigation, Pagination]);

export const SelectCharacter = ({ characters, selectHandler }: React.PropsWithChildren<selectCharacterProps>) => {
    let history = useHistory();

    const [characterIndex, setCharacterIndex] = useState<number>(-1);

    const [viewBio, setViewBio] = useState<boolean>(false);
    const [characterPrizes, setCharacterPrizes] = useState<prize[]>([])
    const [color, selectColor] = useState<string>(categoryColor.physics)

    const chevronLookLeft: IconLookup = { prefix: 'fas', iconName: 'chevron-left' }
    const chevronLookRight: IconLookup = { prefix: 'fas', iconName: 'chevron-right' }
    const chevronLeft: IconDefinition = findIconDefinition(chevronLookLeft)
    const chevronRight: IconDefinition = findIconDefinition(chevronLookRight)

    const handleClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => { setViewBio(!viewBio); }
    const handleSelect = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        selectHandler(characters[characterIndex]);
        history.push("/play");
    }


    return (
        <div className="h-screen w-full p-4">
            <div style={{
                color: color,
                boxShadow: `0 0 .3rem #fff,
            inset 0 0 .3rem #fff,
            0 0 1rem ${color},
            inset 0 0 2rem ${color},
            0 0 0.5rem ${color},
            inset 0 0 0.5rem ${color}`
            }} className={`h-full transition-all duration-200  overflow-hidden flex flex-col justify-between relative border-2 border-white `}>

                <div>

                    <div className={`flex flex-row h-8 justify-between content-center transition-all duration-200 text-gray-400 px-3 pt-2 pb-1.5 text-sm font-light`}>
                        <h4 className=" capsize " >Laureates</h4>
                        <span className="fraction  uppercase"></span>
                    </div>

                    <Swiper
                        initialSlide={Math.random() * characters.length}
                        loop={true}
                        spaceBetween={50}
                        slidesPerView={1}
                        onSlideChange={(SwiperCore) => {
                            const { realIndex, } = SwiperCore;
                            setCharacterIndex(realIndex);
                            setCharacterPrizes(characters[realIndex].prizes);
                            const keyCategory: string = characters[realIndex].prizes.length > 1 ? "special" : characters[realIndex].prizes[0].category as string;
                            selectColor(categoryColor[keyCategory]);
                        }}
                        navigation={{
                            prevEl: '.prev',
                            nextEl: '.next',
                        }}
                        pagination={{
                            el: ".fraction",
                            "type": "fraction"
                        }}
                    >
                        {characters.map((c: laureateI) => {
                            return (
                                <SwiperSlide key={uuidv4()} >
                                    <CharacterCard key={uuidv4()} laureate={c} />
                                </SwiperSlide>
                            )
                        })}

                    </Swiper>
                </div>

                <button className="prev absolute h-full w-7 top-0 z-10 left-2">
                    <FontAwesomeIcon className={`transition-all duration-200 text-gray-300 text-base`} icon={chevronLeft} />
                </button>

                <button className="next absolute h-full w-7 top-0 z-10 right-2">
                    <FontAwesomeIcon className={`transition-all duration-200 text-gray-300 text-base`} icon={chevronRight} />
                </button>


                <button style={{ borderColor: color }} className="border-2 w-3/6 border-opacity-40 opacity-80 text-center mx-auto normal-case font-light py-2 mb-2" onClick={handleClick}>my discovery</button>

                <button style={{ backgroundColor: color }} className={`text-2xl  w-3/6 text-center transition-all duration-200 lowercase  py-2 px-4 mb-6 mx-auto place-self-end z-20`} onClick={handleSelect}>
                    <span className="text-gray-900 font-light">select</span>
                </button>

                {viewBio ? <InfoCard prizes={characterPrizes} color={color} clickHandler={handleClick} /> : <></>}

            </div>
        </div>
    )
}