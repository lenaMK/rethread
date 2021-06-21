

class TimeLineView {
    constructor(container, model) {
        this.container = container;
        this.model = model;
        this.model.addObserver(this);
        this.play_btn = null;
        this.selectMenu = null;
    }

    render() {
        const dimensions = this.model.getTimeLineDimensions();
        const rectDimensions = dimensions.rectDimensions;
        const sliderDimensions = dimensions.sliderDimensions;
        const options = this.model.getSliderSpeed().map(speed => `<option>${speed.text}</option>`);
        const playButton = this.model.getPlayState() ? `<i class="fas fa-pause"></i>` : `<i class="fas fa-play"></i>`;
        const buttons = `
        <div class="flex flex-row content-center items-center  pl-5 ">
            <button id="playBtn" class="transition-colors duration-500 ease-in-out mr-2 rounded-full h-10 w-10 hover:bg-white white hover:text-black text-center focus:border-0 focus:border-transparent focus:outline-none flex items-center justify-center" >${playButton}</button>
            <div class="relative flex items-center">
                <span class="white mr-2">Speed</span>
                <select id="selectMenu" class="h-10 w-24 pl-2 pr-2">
                    ${options}
                </select>
                <div class="pointer-events-auto ...">
                    <svg class="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z"></path></svg>
                </div>
            </div>
        </div>
        `
        const butnContainer = document.getElementById(this.container);
        butnContainer.innerHTML = buttons;
        //ADD ALL THE VISUAL ITEMS 
        //MAIN wrapper in the HTML
        const wrapper = d3.select("#" + this.container)
            .attr("class", "absolute bottom-0 mb-10 left-0  flex flex-col flex-wrap justify-start ")
            .append("svg")
            .attr("width", dimensions.width)
            .attr("height", dimensions.height)

        //general graphic container
        const bounds = wrapper.append("g")
            .style("transform", `translate(${dimensions.margin.left
                }px, ${75
                }px)`)



        const timeLine = bounds.append("g")
            .attr("id", "timeLine")

        timeLine.append("rect")
            .attr("height", rectDimensions.height)
            .attr("width", dimensions.boundedWidth)
            .style("fill", "#ffffff")

        const slider = timeLine.append("g")
            .attr("id", "sliderTimeLine")
            .style("transform", `translate(${0
                }px, ${-sliderDimensions.height / 2
                }px)`)

        slider.append("rect")
            .attr("height", sliderDimensions.height)
            .attr("width", sliderDimensions.width)
            .style("fill", "#ffffff")

        const phantomSlider = timeLine.append("g")
            .attr("id", "phantomSlider")
            .style("transform", `translate(${0
                }px, ${-sliderDimensions.height / 2
                }px)`)
            .attr("opacity", 0)

        phantomSlider.append("rect")
            .attr("height", sliderDimensions.height)
            .attr("width", sliderDimensions.width)
            .style("fill", "#ffffff")

        phantomSlider.append("text")
            .attr("id", "phatomTime")
            .attr("y", -10)
            .style("fill", "#ffffff")
            .text()

        const today = timeLine.append("g")
            .attr("id", "phantomSlider")
            .style("transform", `translate(${dimensions.boundedWidth
                }px, ${-sliderDimensions.height / 2
                }px)`)

        today.append("rect")
            .attr("height", sliderDimensions.height)
            .attr("width", sliderDimensions.width)
            .style("fill", "#ffffff")

        today.append("text")
            .attr("id", "todaysDate")
            .attr("y", -10)
            .style("fill", "#ffffff")
            .text("Today")
            .attr("text-anchor", "end")

        bounds.append("rect")
            .attr("id", "timeLinebounds")
            .attr("class", "noColor")
            .style("transform", `translate(${0
                }px, ${-sliderDimensions.height / 2
                }px)`)
            .attr("height", sliderDimensions.height)
            .attr("width", dimensions.boundedWidth)

        this.updateSlider()
        // this.renderAllAxis()
        this.setIdentifications();
    }

    updateSlider() {
        const { height, width } = this.model.getSliderHeight();
        const getSliderXPos = this.model.calculateSliderPos();
        // const currentTime = this.model.getCurrentTime();
        // const isMiddle = this.model.isSliderInMiddle() ? "end" : "start";

        d3.select("#sliderTimeLine")
            .style("transform", `translate(${getSliderXPos - width / 2
                }px, ${-height / 2
                }px)`)
        // d3.select("#currentTime")
        //     .text(currentTime)
        //     .attr("text-anchor", isMiddle)

    }

    renderAllAxis() {
        //get all axis from model
        this.model.calculateBottomAxis()
            .forEach(axis => {
                d3.select("#timeLine")
                    .append("g")
                    .call(axis.axis
                        .ticks(axis.numTicks)
                        .tickFormat(axis.format)
                        .tickPadding(axis.padding)
                    );
            })
    }

    updatePhantomSlider(formatedDate, isMiddle, slidePos) {
        const sliderDimensions = this.model.getTimeLineDimensions().sliderDimensions;

        d3.select("#phantomSlider")
            .style("transform", `translate(${slidePos
                }px, ${-sliderDimensions.height / 2
                }px)`)
        d3.select("#phatomTime")
            .text(formatedDate)
            .attr("text-anchor", isMiddle)
    }

    viewPhantomSlider(view) {
        d3.select("#phantomSlider")
            .attr("opacity", view ? 1 : 0)
    }

    updatePlayBtn() {
        const playButton = this.model.getPlayState() ? `<i class="fas fa-pause"></i>` : `<i class="fas fa-play"></i>`;
        const butnContainer = document.getElementById("playBtn");
        butnContainer.innerHTML = playButton;
    }


    update(changeDetails) {
        if (changeDetails.type == "updateTimeLine") {
            // this.renderAllAxis();
            this.updateSlider();
        } else if (changeDetails.type == "updateCurrentVisit") {
            this.updateSlider();
        } else if (changeDetails.type == "playTimeLine") {
            this.updatePlayBtn();
        } else if (changeDetails.type == "pauseTimeLine") {
            this.updatePlayBtn();
        }
    }

    setIdentifications() {
        this.play_btn = document.getElementById("playBtn");
        this.selectMenu = document.getElementById("selectMenu")
        this.timeline = document.getElementById("timeLinebounds")
        this.phantomSlider = document.getElementById("phantomSlider");

    }

}
