/*
 * From https://www.redblobgames.com/grids/hexagons/
 * Copyright 2018 Red Blob Games <redblobgames@gmail.com>
 * License: Apache v2.0 <http://www.apache.org/licenses/LICENSE-2.0.html>
 *
 * This module implements the components to make hex diagrams. See
 * index.js for the instances of diagrams on index.html.
 */
'use strict';

/* global Point, Layout, Hex, OffsetCoord, hex_equal,
   hexSetBounds, IntersectionObserver, breadthFirstSearch */

const SCALE = 100;

const layouts = {
    flat:   new Layout(Layout.flat,   new Point(SCALE, SCALE), new Point(0, 0)),
    pointy: new Layout(Layout.pointy, new Point(SCALE, SCALE), new Point(0, 0)),
};


/* I pre-render the page on the server, and then I run the same code again
   on the client. Occasionally it's useful to know whether I'm on the server
   or client, so I have this flag. See
   <https://antoinevastel.com/bot%20detection/2017/08/05/detect-chrome-headless.html> */
const isRunningInHeadlessChrome = /HeadlessChrome/.test(window.navigator.userAgent);


/* Animation mixin requires the target Vue instance to have a 
   'phase' field that is the target value, and the mixin provides
   a 'phaseInterpolation' field with the interpolated value. The
   expected values of 'phase' are 0 and 1. */
function AnimationMixin(period) {
    return {
        data: {
            phaseInterpolation: 0,
            _animation: null,
            _animationPreviousMs: 0,
        },
        created() {
            this.phaseInterpolation = this.phase;
        },
        watch: {
            phase() {
                if (!this._animation) {
                    this._animation = requestAnimationFrame(this.animate);
                    this._animationPreviousMs = 0;
                }
            },
        },
        methods: {
            animate(timestampMs) {
                let dt = timestampMs - (this._animationPreviousMs || timestampMs);
                this._animationPreviousMs = timestampMs;
                this._animation = null;

                let delta = this.phase - this.phaseInterpolation;
                if (delta !== 0) {
                    let step = Math.min(dt/period, Math.max(-dt/period, delta));
                    this.phaseInterpolation += step;
                    this._animation = requestAnimationFrame(this.animate);
                }
            },
        },
    };
}


/* Map the animation phase (0:1) to a rotation (flat 0 : pointy -30) */
function makeAnimatedLayout() {
    return new Vue({
        mixins: [AnimationMixin(500)],
        data: {
            layout:   'pointy',
            variants: 'both',
        },
        computed: {
            phase()                 { return this.layout === 'flat'? 0 : 1; },
            rotation()              { return this.phaseToRotation(this.phase); },
            rotationInterpolation() { return this.phaseToRotation(this.phaseInterpolation); },
        },
        methods: {
            phaseToRotation(t) {
                // Picked these cubic function constants by experimenting
                // with Desmos
                const B = -1.1;
                const C = 4;
                let ease = B * (1-t)*(1-t)*t + C * (1-t)*t*t + 1*t*t*t;
                return ease * -30;
            },
        },
    });
}


/* Each diagram can be flat orientation, pointy orientation, or toggleable;
   some diagrams will add their own makeAnimatedLayout so that they can be
   toggled separately from the global one */
const orientations = {
    global: makeAnimatedLayout(),
    flat: {
        layout: 'flat',
        rotation: 0,
        rotationInterpolation: 0,
        variants: 'flat',
    },
    pointy: {
        layout: 'pointy',
        rotation: -30,
        rotationInterpolation: -30,
        variants: 'pointy',
    },
};


/* flat topped hex position */
function hexCenter(hex) {
    let p = layouts.flat.hexToPixel(hex);
    return {
        x: p.x,
        y: p.y,
        transform: `translate(${p.x.toFixed(0)},${p.y.toFixed(0)})`,
    };
}


Vue.filter('signed', value => (value > 0? '+':'') + value);


Vue.component('a-arrow', {
    props: ['w', 'skip', 'A', 'B', 'withHead', 'withBase'],
    template: `<path :transform="transform" :d="d"/>`,
    computed: {
        transform() {
            let dx = this.A.x - this.B.x,
                dy = this.A.y - this.B.y,
                angle = 180 / Math.PI * Math.atan2(dy, dx);
            return `translate(${this.B.x.toFixed(1)},${this.B.y.toFixed(1)}) rotate(${angle})`;
        },
        d() {
            let {w, skip, A, B, withHead, withBase} = this;
            let length = Math.sqrt((A.x-B.x)*(A.x-B.x) + (A.y-B.y)*(A.y-B.y));
            var h = length - 2*w-(skip || 0);

            var path_d = ['M', 0, 0];
            if (h > 0.0) {
                path_d = path_d.concat([
                    'l', 2*w, 2*w,
                    'l', 0, -w,
                    'l', h, 0,
                    'l', -0.3*w, -w,
                    'l', 0.3*w, -w,
                    'l', -h, 0,
                    'l', 0, -w,
                    'Z']);
                if (withHead) {
                    path_d = path_d.concat([
                        'M', 0, -10*w,
                        'l', 0, 20*w
                    ]);
                }
                if (withBase) {
                    path_d = path_d.concat([
                        'M', h+w, -10*w,
                        'l', 0, 20*w
                    ]);
                }
            }
            return path_d.join(" ");
        },
    },
});


Vue.component('axis-arrow', {
    props: ['axis', 'label', 'angle'],
    template: `<g :transform="point_at">
                 <a-arrow :class="axis" :w="10" :A="point(-8)" :B="point(-1.5)"/>
                 <a-text>{{label}}</a-text>
               </g>`,
    computed: {
        point_at() {
            let p = this.point(9);
            return `translate(${p.x},${p.y})`;
        },
    },
    methods: {
        point(r) {
            const scale = 15;
            return {x: scale * r * Math.cos(this.angle * Math.PI/180),
                    y: scale * r * Math.sin(this.angle * Math.PI/180)};
        },
    },
});


Vue.component('a-toggle-orientation', {
    template: `<g>
                  <g :class="['toggle-orientation', layout==='flat'? 'selected' : null]"
                     transform="translate(-175,-50) scale(0.5)"
                     @click="setLayout('flat')">
                    <a-hex/>
                    <text dy="0.4em">flat</text>
                  </g>
                  <g :class="['toggle-orientation', layout==='pointy'? 'selected' : null]"
                     transform="translate(-75,-50) rotate(-30) scale(0.5)"
                     @click="setLayout('pointy')">
                    <a-hex/>
                    <text dy="0.4em" transform="rotate(30)"">pointy</text>
                  </g>
               </g>`,
    computed: {
        layout() { return orientations.global.layout; },
    },
    methods: {
        setLayout(layout) { orientations.global.layout = layout; },
    },
});


/* NOTE: I tried defining this once in <defs> and then using <use>
   but the css doesn't apply to the <use>d version, and I need the
   css rule. If I can figure out how to make the css work, it would
   reduce the output prerendered html from 591k to 432k! */
const polygonVerticesFlat =
      layouts.flat
        .polygonCorners(new Hex(0,0,0))
        .map(p=>`${p.x.toFixed(0)},${p.y.toFixed(0)}`)
        .join(" ");
Vue.component('a-hex', {
    template: `<polygon v-once points="${polygonVerticesFlat}"/>`,
});


Vue.component('a-circle-marker', {
    template: `<circle v-once class="marker" r="5"/>`,
});


Vue.component('a-text', {
    template: `<text dy="0.4em" :transform="transform"><slot/></text>`,
    computed: {
        transform() {
            return `rotate(${-this.$root.rotation})`;
        },
    },
});


Vue.component('a-cube-label', {
    props: ['labels'],
    template: `<g><text v-for="(label, index) in labels" :key="index" 
                     :class="'qrs'[index]+'-coord'"
                     :transform="transform(index)"
                     v-text="typeof label === 'number' &amp;&amp; label > 0 ? '+'+label : label"
                 /></g>`,
    methods: {
        transform(index) {
            const rotation = -this.$root.rotation; /* from 0° to 30° */
            const labelRotation = 90; // 0 places them at corners, 90 places them on edges
            let x = [15, -7.5, -7.5][index] ;
            let y = [0, 13, -13][index]; //  + 3 * (30 - rotation) / 30
            return `rotate(${-labelRotation}) translate(${x* SCALE/25}, ${y * SCALE/25}) rotate(${labelRotation}) rotate(${rotation}) translate(0,10)`;
        },
    },
});


Vue.component('a-grid', {
    props: ['hexes', 'walls', 'setHighlight'],
    template: `<g :class="['grid']" 
                 @mousemove="mouse" @touchstart="touch" @touchmove="touch"
                 @mousedown="mousedown">
                 <g v-for="(hex, index) in hexes" :key="index"
                    :transform="center(hex).transform">
                    <slot :index="index" :hex="hex"/>
                 </g>
              </g>`,
    methods: {
        center: hexCenter,
        screenToHexPosition(position) {
            let point = this.$el.ownerSVGElement.createSVGPoint();
            point.x = position.clientX;
            point.y = position.clientY;
            let localCoords = point.matrixTransform(this.$el.getScreenCTM().inverse());
            let fractionalHex = layouts.flat.pixelToHex(localCoords);
            let roundedHex = fractionalHex.round();
            /* NOTE: It's possible we end up picking a hex that's not 
               in the original grid. This causes corner cases with many
               diagrams, so we want to skip them. Look for a hex in the
               original grid data instead of returning roundedHex. This
               also handles cases where the original grid is annotated
               with additional data. */
            let hex = this.hexes.find(hex => hex_equal(hex, roundedHex));
            return {fractionalHex, hex};
        },
        mousedown(event) {
            if (event.button === 0 && this.walls) {
                let {hex} = this.screenToHexPosition(event);
                if (hex) {
                    let paint = !this.walls[hex];
                    const move = (event) => {
                        let {hex} = this.screenToHexPosition(event);
                        Vue.set(this.walls, hex, paint);
                        event.preventDefault();
                        event.stopPropagation();
                    };
                    const up = (event) => {
                        move(event);
                        window.removeEventListener('mousemove', move, true);
                    };
                    window.addEventListener('mousemove', move, {capture: true});
                    window.addEventListener('mouseup', up, {capture: true, once: true});
                    move(event);
                }
            }
        },
        mouse(event) {
            this.handleHighlight(event, event);
        },
        touch(event) {
            for (let i = 0; i < event.changedTouches.length; i++) {
                const touch = event.changedTouches[i];
                this.handleHighlight(event, touch);
            }
        },
        handleHighlight(event, position) {
            if (this.setHighlight) {
                let {fractionalHex, hex} = this.screenToHexPosition(position);
                if (hex) {
                    this.setHighlight(hex, fractionalHex);
                    event.stopPropagation();
                    event.preventDefault();
                }
            }
        },
    },
});


Vue.component('a-svg', {
    props: {
        orientationButtonScale: {type: Number, default: 1},
        padding: {type: Number, default: 20},
    },
    template: `<svg :view-box.camel="viewBox.join(' ')">
                 <g :transform="rotation" fill="white" stroke="black">
                   <slot/>
                 </g>
                 <a-toggle-orientation 
                    v-if="$root.orientation.variants === 'both' &amp;&amp; orientationButtonScale &gt; 0"
                    :transform="\`translate(\${viewBox[0]+viewBox[2]},\${viewBox[1]+viewBox[3]}) scale(\${orientationButtonScale})\`"
                 />
               </svg>`,
    computed: {
        rotation() {
            return `rotate(${this.$root.rotation})`;
        },
        viewBox() {
            const padding = this.padding;
            let {variants} = this.$root.orientation;
            let rect1  = hexSetBounds(layouts.flat, this.$root.grid);
            let rect2  = hexSetBounds(layouts.pointy, this.$root.grid);
            let rect = variants === 'flat'? rect1
                : variants === 'pointy'? rect2
                : {
                    left: Math.min(rect1.left, rect2.left),
                    top: Math.min(rect1.top, rect2.top),
                    right: Math.max(rect1.right, rect2.right),
                    bottom: Math.max(rect1.bottom, rect2.bottom),
                };
            let left   = rect.left - padding,
                top    = rect.top - padding,
                width  = rect.right - rect.left + 2 * padding,
                height = rect.bottom - rect.top + 2 * padding;
            return [left, top, width, height];
        },
    },
});


let mixins = {
    highlight: {
        data() {
            return {
                highlight: new Hex(0, 0, 0),
                highlightFractional: new Hex(0, 0, 0),
            };
        },
        methods: {
            setHighlight(hex, fractionalHex) {
                if (!hex_equal(hex, this.highlight)) { this.highlight = hex; }
                this.highlightFractional = fractionalHex;
            },
        },
    },
    /* Pathfinding to this.highlight . The diagram must provide an
       isWall( hex ) method that returns true if there's a wall at that hex */
    pathfinding: {
        computed: {
            breadthFirstSearch() {
                return breadthFirstSearch(new Hex(0, 0, 0), this.isWall);
            },
            /* Returns the array of hexes, but toString() will convert to a <path d=...> */
            reconstructedPath() {
                const came_from = this.breadthFirstSearch.came_from;
                let path = [];
                let d = [];
                for (let hex = this.highlight; hex; hex = came_from[hex]) {
                    let {x, y} = layouts.flat.hexToPixel(hex);
                    path.push(hex);
                    d.push(d.length === 0? 'M' : 'L', x, y);
                }
                path.toString = () => d.join(" ");
                return path;
            },
        },
    },
};


if (!window.IntersectionObserver) {
    /* This should be in most browsers now https://caniuse.com/#feat=intersectionobserver 
       but if it is not, my fallback will be to render everything on page load, and animate
       all diagrams instead of only animating the ones visible. Slower, but it will work. */
    window.IntersectionObserver = function(callback) {
        this.observe = el => callback([{intersectionRatio: 1, target: el}]);
        this.unobserve = el => null;
    };
}

let diagrams = {_count: 0};
let visibilityObserver = new IntersectionObserver(entries => {
    for (let entry of entries) {
        entry.target.vm.visible = entry.intersectionRatio > 0;
    }
});
let prerenderObserver = new IntersectionObserver(entries => {
    for (let entry of entries) {
        if (entry.intersectionRatio > 0) {
            /* This section of the page is now visible, so swap the
               prerendered version out and put in the interactive
               version. */
            entry.target.setup(); // replace element with Vue's version
            prerenderObserver.unobserve(entry.target);
        }
    }
});
                                                 
function Diagram(id, config) {
    if (!config.el)       { config.el = "#diagram-" + id; }
    if (!config.template) { config.template = "#template-diagram-" + id; }
    if (!config.data)     { config.data = {}; }
    if (!config.computed) { config.computed = {}; }
    
    let orientation = orientations[config.layout || 'global'];
    config.data.orientation = orientation;
    config.data.visible = false;
    config.computed.rotation = function() {
        return this.visible?
            this.orientation.rotationInterpolation : this.orientation.rotation;
    };

    function setup() {
        let vm = new Vue(config);
        diagrams[id.replace(/-/g, '_')] = vm;

        // Register this diagram with the intersection observer so that it
        // can keep track of whether it's visible
        Vue.nextTick(() => {
            vm.$el.vm = vm;
            visibilityObserver.observe(vm.$el);
        });
    }

    const el = document.querySelector(config.el);
    if (isRunningInHeadlessChrome) {
        setup();
        /* Tell Vue to reuse this part of the DOM
         * https://ssr.vuejs.org/guide/hydration.html */
        el.setAttribute('data-server-rendered', "true");
        
        /* Remove the SVG contents for the pre-rendered version. This
           is a huge part of the page, 454k of the 633k (30k of the
           60k compressed). It takes longer to load the html (network)
           and also longer to display the page (lots of dom nodes to
           parse and lay out). Unfortunately, this also means people
           who don't have Javascript won't be able to see the
           diagrams. */
        // for (let element of document.querySelector(config.el).querySelectorAll("svg")) {
        //      element.innerHTML = "";
        // }
        /* NOTE: It doesn't work in safari's reader mode, or when
         * printing the page, or ctrl+f, or possibly other uses too.
         * For printing, I could use the window.onbeforeprint event to
         * render all the SVG. I think reader mode may be a lost
         * cause. Ctrl+F for text inside diagrams seems like a fairly
         * unimportant use. */
    } else {
        if (el && el.tagName !== "TEMPLATE") {
            /* Vue will "hydrate" the non-interactive prerendered version with
               an interactive version. We don't need to do this until the diagram
               is visible on the page. */
            el.setup = setup;
            prerenderObserver.observe(el);
        } else {
            /* This is the version of the page without pre-rendering support */
            setup();
        }
    }
}
