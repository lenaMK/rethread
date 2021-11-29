import React from 'react';
import { Link } from "react-router-dom";
import {
    IconLookup,
    IconDefinition,
    findIconDefinition
} from '@fortawesome/fontawesome-svg-core'
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

export const About = () => {
    const chevronLookLeft: IconLookup = { prefix: 'fas', iconName: 'chevron-left' };
    const chevronLeft: IconDefinition = findIconDefinition(chevronLookLeft);

    return <div className="flex flex-col w-screen place-content-center pb-6">
        <div className="flex flex-row justify-between text-sm content-center pt-2">
            <Link to={"/home"} className="text-gray-400  h-8 w-4/8 p-2 ">
                <FontAwesomeIcon className="yellow-300 text-xs" icon={chevronLeft} /> Back
            </Link>
        </div>
        <h1 className="text-white text-xl text-center lowercase font-light "><span className="text-yellow-300 font-thin text-4xl text-neon-yellow">cyber|glow</span></h1>

        <div className="w-10/12 mt-6 text-gray-300 mx-auto text-md font-light leading-6">
            <h2 className="text-yellow-300 font-thin text-2xl text-neon-yellow">About</h2>
            <p>cyber|glow is a light installation, generated in real time based on the interactions of the visitors. It reveals the invisible and live software traces that operate an interactive game.
            </p>
            <br />
            <h2 className="text-yellow-300 font-thin text-2xl text-neon-yellow">cyber|glow is a diptych.</h2>
            <br />
            <img src="/screen.jpg" alt="cyber|glow" className=" object-contain w-6/6 h-auto align-middle border-none mb-4" />
            <p>One part is a multi-player, interactive game. The visitors can select a laureate and control its movement on a large wall, through their phone. By picking their favorite Nobel laureate and moving their avatar around on a projection, the visitors will create an illusory mingle with some of the top scientists of all time. Users also learn more about the scientific discovery that earned their laureate their prize.
            </p>
            <br />
            {/* <img src="/laser.jpg" alt="WASP" className=" object-contain w-6/6 h-auto align-middle border-none mb-4" /> */}
            <video autoPlay loop muted poster="/laser_ftrace1.jpg">
                <source type="video/mp4" src="/video/cyberglow_ftrace_zoom.mp4" />
            </video> <br />
            <p>Another part of cyber|glow is a real-time observation and visualization system producing the laser movements that create the light art projection. This projection reveals the invisible game events, database accesses, systems calls, network events and function calls that operate at high frequency to deliver the game.
            </p>
            <br />
            <p>Software is the core medium that fuels our digital society, providing services to citizens, governments, activists and corporations. It is an invisible and intangible set of processes that run millions of operations per second, on top of world-wide networks. With cyber|glow, we wish to unveil these invisible processes and let citizens realize the extraordinary scale of software that surrounds them.
            </p>
            <br />
            {/* <img src="/laser_zoomed_out.jpg" alt="WASP" className=" object-contain w-6/6 h-auto align-middle border-none mb-4" /> */}
            <video autoPlay loop muted poster="/laser_zoomed_out.jpg">
                <source type="video/mp4" src="/video/cyberglow_zoomed_out1.mp4" />
            </video> <br />
            <p>
                The zoomed out laser view shows the three core part of the infrastructure of this installation: the users' devices in the bottom  right, the web server instance in the top and the computer in charge of the visuals in the bottom left.
            </p>
            <br />
            {/* <img src="/laser_webserver1.jpg" alt="Laser visualisation of the web server events" className=" object-contain w-6/6 h-auto align-middle border-none mb-4" /> */}
            <video autoPlay loop muted poster="/laser_webserver1.jpg">
                <source type="video/mp4" src="/video/cyberglow_webcircle1.mp4" />
            </video> <br />
            <p>Zooming in on the top middle circle revealse a laser visualisation of what is going on inside the web server: files being loaded, events being passed on, state being changed and queries to the database.</p>
            <br />
            {/* <img src="/laser_user1.jpg" alt="Laser visualisation of user data" className=" object-contain w-6/6 h-auto align-middle border-none mb-4" /> */}
            <video autoPlay loop muted poster="/laser_user1.jpg">
                <source type="video/mp4" src="/video/cyberglow_user.mp4" />
            </video> <br />
            <p>When the installation zooms in on the bottom right, events created by the user will be visualised, either as a text message displaying the particular action, or as a red dot representing the activation of an action.</p>
            <br />
            {/* <img src="/laser_ftrace1.jpg" alt="Laser visualisation of system data" className=" object-contain w-6/6 h-auto align-middle border-none mb-4" /> */}
            <video autoPlay loop muted poster="/laser_ftrace1.jpg">
                <source type="video/mp4" src="/video/cyberglow_ftrace1.mp4" />
            </video> <br />
            <p>The bottom left position shows the internal low level system activity of the computer creating the visuals for the game and for the laser: errors reported, requests to the operating system to access the hardware and mechanisms to harness inputs to create truly random cryptographically secure numbers.</p>
            
            <br />
            <h2 className="text-yellow-300 font-thin text-2xl text-neon-yellow">re|thread</h2>
            <p>cyber|glow was designed and developed by the <a href="https://rethread.art/#" target="_blank" rel='noreferrer' className="text-neon-yellow">rethread.art</a> collective: Erik Natanael Gustafsson, Thomas Durieux, Jonathan Ramirez Mendoza, and Benoit Baudry. For cyber|glow, re|thread collective features Ambar Troya, graphic designer and game artist.</p>

            <br />
            <h2 className="text-yellow-300 font-thin text-2xl text-neon-yellow ">Acknowledgments</h2>
            <div className="flex flex-row justify-center content-center space-x-10 mt-5">
                <img src="/logo_kth.png" alt="KTH" className=" object-contain w-2/6 h-auto align-middle border-none" />
                <img src="/logo_nobel.png" alt="Nobel Week of Lights" className=" object-contain w-2/6 h-auto align-middle border-none" />
            </div>
            <div className="flex flex-row justify-center content-center space-x-10 my-4">
                <img src="/logo_wasp.png" alt="WASP" className=" object-contain w-5/6 h-auto align-middle border-none" />
            </div>
            <p className="text-xs text-center">The research that this installation is based on was developed through WASP, a program supported by the Knut och Alice Wallenbergs Stiftelse
            </p>
        </div>
    </div>
}