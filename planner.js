"use strict";

function assert(val, msg) {
    if (!val) {
        alert('assertion error: ' + msg + ' \n (' + val + ')');
    }
}

function snap(num, min, max) {
    if (num < min) {
        return min;
    } else if (num > max) {
        return max;
    } else {
        return num;
    }
}


function Grid(canvas, _corner_offset, _dot_radius, _dot_spacing) {
    let points = null;
    let dot_radius = _dot_radius;

    // TODO: context.scale might be a better way of dealing with this
    let dot_spacing = _dot_spacing;
    // N.B. context.translate seems unlikely to be an improvement for the
    // corner offset, since i want an offset on *each* corner.
    let corner_offset = _corner_offset;
    const w = canvas.getAttribute('width');
    const h = canvas.getAttribute('height');
    const xstart = corner_offset + dot_radius;
    const xend = w - corner_offset - dot_radius;
    const ystart = corner_offset + dot_radius;
    const yend = h - corner_offset - dot_radius;

    function init() {
        points = [];
        for (let x = xstart; x < xend; x += dot_spacing) {
            let cur_row = [];
            for (let y = ystart; y < yend; y += dot_spacing) {
                cur_row.push({
                    x: x,
                    y: y,
                    colour: '#000000',
                });
            }
            points.push(cur_row);
        }
    }

    function draw_dot(ctx, x, y) {
        let point = points[x][y]
        // is doing so many beginPath/fills going to be a performance issue?
        // probably but i will worry about it when i get there, maybe
        ctx.beginPath();
        ctx.moveTo(point.x, point.y);
        ctx.arc(point.x, point.y, dot_radius, 0, 2*Math.PI);
        ctx.fillStyle = point.colour
        ctx.fill();
    }

    function scale(canvas_val) {
        return Math.round((canvas_val - corner_offset) / dot_spacing);
    }

    this.canvas_coords = function(dot) {
        let point = points[dot.x_coord][dot.y_coord];
        return {
            x: point.x,
            y: point.y,
        };
    }

    // take x, y as position on canvas, return x, y s.t. points[x][y] is
    // nearest point
    this.find_closest_dot = function(pos) {
        let dimensions = this.dimensions();
        let scaled_x = snap(scale(pos.x), 0, dimensions.width - 1);
        let scaled_y = snap(scale(pos.y), 0, dimensions.height - 1);

        return {
            x_coord: scaled_x,
            y_coord: scaled_y,
        }

    }

    this.colour_dot = function(dot_coords, colour) {
        let dot = points[dot_coords.x_coord][dot_coords.y_coord];
        if (dot.colour !== colour) {
            dot.colour = colour;
        }
    }

    this.draw = function(ctx) {
        for (let i = 0; i < points.length; i++) {
            for (let j = 0; j < points[i].length; j++) {
                draw_dot(ctx, i, j);
            }
        }
    }

    this.dimensions = function() {
        return {
            width: points.length,
            height: points[0].length,
        }
    }

    this.displacement = function(from, to) {
        // distance b/w 2 pixels normalized to grid units
        let x_disp = scale(to.x) - scale(from.x);
        let y_disp = scale(to.y) - scale(from.y);
        return {
            x_disp: x_disp,
            y_disp: y_disp,
        }
    }

    this.reinit = function() {
        init();
    }

    init();
}

function RoomPlanner(_canvas) {
    let canvas = _canvas;
    let ctx = canvas.getContext('2d');

    const buttons = document.getElementById('buttons');
    const undo_add_wall = document.getElementById('undo-add-wall');
    const delete_selected_object = document.getElementById('delete-selected-obj');
    const rotate_selected_object = document.getElementById('rotate-selected-obj');
    const selected_object_name = document.getElementById('selected-object-name');
    const mode_span = document.getElementById('current-mode');
    const grid_width_span = document.getElementById('grid-width');
    const grid_height_span = document.getElementById('grid-height');
    const add_object_form = document.getElementById('add-object');
    const object_inventory_div = document.getElementById('object-inventory');
    const reset_button = document.getElementById('reset-everything');
    const reset_objects_button = document.getElementById('reset-objects');

    const store_configuration_form = document.getElementById('store-configuration');
    const stored_configurations_div = document.getElementById('stored-configurations');


    const CORNER_OFFSET = 10;
    const w = canvas.getAttribute('width');
    const h = canvas.getAttribute('height');
    const DOT_RAD = 2;
    const DOT_SPACING = 16;
    const WALL_COLOUR = '#00FF00';
    const OBJ_COLOUR = '#0000FF';
    const SELECTED_OBJ_COLOUR = '#00CCCC';

    const CACHE_KEY = 'room-planner';

    let grid = null;

    let current_mode = null;
    let state = {
    };

    let walls = [];
    let objects = {};
    let drawn_objs = [];
    let selected_object = null;
    let currently_rehydrating = false;
    let stored_configurations = {};

    // stolen from https://stackoverflow.com/a/33063222
    function get_mouse_pos(evt) {
        let rect = canvas.getBoundingClientRect();
        return {
            x: (evt.clientX - rect.left) / (rect.right - rect.left) * w,
            y: (evt.clientY - rect.top) / (rect.bottom - rect.top) * h,
        };
    }

    function draw_dot(x, y) {
        ctx.moveTo(x, y);
        ctx.arc(x, y, DOT_RAD, 0, 2*Math.PI);
    }

    function build_grid() {
        grid = new Grid(canvas, CORNER_OFFSET, DOT_RAD, DOT_SPACING);
    }

    function draw_wall(start, end, colour=WALL_COLOUR) {
        let dx = Math.abs(end.x_coord - start.x_coord);
        let dy = Math.abs(end.y_coord - start.y_coord);
        let true_end = {
            x_coord: end.x_coord,
            y_coord: end.y_coord,
        }
        if (dx < dy) {
            true_end.x_coord = start.x_coord;
        } else {
            true_end.y_coord = start.y_coord;
        }
        let start_coords = grid.canvas_coords(start);
        let end_coords = grid.canvas_coords(true_end);

        ctx.beginPath();
        ctx.moveTo(start_coords.x, start_coords.y);
        ctx.lineTo(end_coords.x, end_coords.y);
        ctx.lineWidth = 3;
        ctx.strokeStyle = colour;
        ctx.stroke();

        return {
            start: Object.assign({}, start),
            end: Object.assign({}, true_end),
        };
    }

    function draw_walls() {
        for (let i = 0; i < walls.length; i++) {
            draw_wall(walls[i].start, walls[i].end);
        }
    }

    function draw_obj(obj) {
        let lx = obj.upper_left_x;
        let uy = obj.upper_left_y;
        let rx = lx + obj.width;
        let by = uy + obj.height;

        let ul = {
            x_coord: lx,
            y_coord: uy,
        };
        let ur = {
            x_coord: rx,
            y_coord: uy,
        };
        let bl = {
            x_coord: lx,
            y_coord: by,
        };
        let br = {
            x_coord: rx,
            y_coord: by,
        };
        draw_wall(ul, ur, obj.colour);
        draw_wall(ur, br, obj.colour);
        draw_wall(br, bl, obj.colour);
        draw_wall(bl, ul, obj.colour);
        let upper_left_canvas = grid.canvas_coords(ul);
        let bottom_left_canvas = grid.canvas_coords(bl);
        let name_y = (bottom_left_canvas.y + upper_left_canvas.y) / 2
        let name_x = upper_left_canvas.x + DOT_RAD

        ctx.fillText(obj.name, name_x, name_y, DOT_SPACING * obj.width - 2 * DOT_RAD);

        // make dots in the furniture interior less obtrusive
        for (let x = ul.x_coord + 1; x < ur.x_coord; x++) {
            for (let y = ul.y_coord + 1; y < bl.y_coord; y++) {
                grid.colour_dot({
                    x_coord: x,
                    y_coord: y,
                }, '#dddddd');

            }
        }
    }

    function draw_objs() {
        for (let i = 0; i < drawn_objs.length; i++) {
            let obj = drawn_objs[i];
            draw_obj(obj);
        }
    }

    // should this be part of the grid's brain? or maybe some third object?
    // feels a little messy to have rooms/objs be part of this object
    function redraw() {
        ctx.clearRect(0, 0, w, h);
        grid.reinit();
        // note that this ordering is important to make things look nice, but
        // hella fragile and someone who actually understands graphics and how
        // to order these kinda things would presumably look on in horror.
        draw_objs();
        grid.draw(ctx);
        draw_walls();
    }

    function set_mode(mode) {
        mode_span.innerHTML = mode;
        reinit_objects_state();
        reinit_wall_state();
        current_mode = mode;
    }

    function handle_mode_change(event) {
        if (event.target.dataset.mode) {
            set_mode(event.target.dataset.mode);
        }
    }

    function reinit_wall_state() {
        state.walls = {
            mode: 'start',
            start_dot: null,
        }
    }

    function reinit_objects_state() {
        state.objects = {
            mode: 'start',
        }
    }

    function add_wall(wall) {
        walls.push(wall);
        undo_add_wall.classList.remove('hidden');
        save_state();
    }

    function handle_walls_mousedown(event) {
        if (state.walls.mode !== 'start') {
            // mouse moved off canvas and is now back on.
            return;
        }
        let pos = get_mouse_pos(event);
        let dot = grid.find_closest_dot(pos);
        state.walls = {
            mode: 'drawing',
            start_dot: dot,
        }
    }

    function handle_walls_mousemove(event) {
        if (state.walls.mode !== 'drawing') {
            // only wanna do this shit while the mouse is down
            return;
        }
        let pos = get_mouse_pos(event);
        let end = grid.find_closest_dot(pos);
        if (end === null) {
            // mouse has gone off grid
        }
        redraw();
        draw_wall(state.walls.start_dot, end);
    }

    function handle_walls_mouseup(event) {
        if (state.walls.mode !== 'drawing') {
            // this is fine; a user can click outside of the canvas and move
            // the mouse in and let go, which is not an error condition
            return;
        }
        let pos = get_mouse_pos(event);
        let end = grid.find_closest_dot(pos);
        let wall = draw_wall(state.walls.start_dot, end);
        add_wall(wall);
        reinit_wall_state();
    }

    function contains(obj, mouse_pos) {
        let grid_obj = {
            x_coord: obj.upper_left_x,
            y_coord: obj.upper_left_y,
        };
        let upper_left_canvas = grid.canvas_coords(grid_obj);
        let x_min = upper_left_canvas.x;
        let y_min = upper_left_canvas.y;
        let lower_right_canvas = grid.canvas_coords({
            x_coord: grid_obj.x_coord + obj.width,
            y_coord: grid_obj.y_coord + obj.height,
        });
        let x_max = lower_right_canvas.x;
        let y_max = lower_right_canvas.y;
        return (
            x_min < mouse_pos.x         &&
                    mouse_pos.x < x_max &&
            y_min < mouse_pos.y         &&
                    mouse_pos.y < y_max
        );
    }

    function find_containing_obj(pos) {
        // returns the reference to the drawn object that contains the given
        // point, if any; otherwise null. if multiple objects contain the given
        // point, the one that was added to the canvas most recently wins.
        if (drawn_objs.length == 0) {
            return null;
        }
        for (let i = drawn_objs.length - 1; i >= 0; i--) {
            if (contains(drawn_objs[i], pos)) {
                return drawn_objs[i];
            }
        }
        return null;
    }

    function select_obj(obj) {
        selected_object = obj;
        obj.colour = SELECTED_OBJ_COLOUR;
        delete_selected_object.classList.remove('hidden');
        rotate_selected_object.classList.remove('hidden');
        selected_object_name.innerText = obj.name;
        redraw();
    }

    function clear_selected_object() {
        if (selected_object === null) {
            // thats fine, no need to be paranoid about state management here.
            return;
        }
        selected_object.colour = OBJ_COLOUR;
        selected_object = null;
        delete_selected_object.classList.add('hidden');
        rotate_selected_object.classList.add('hidden');
        // note that this is called immediately before another redraw in some
        // cases, which is pretty dumb, but i dont see any performance
        // implication so w/e
        redraw();
    }

    function handle_objects_mousedown(event) {
        if (state.objects.mode !== 'start') {
            // mouse moved off and back on
            return;
        }
        let pos = get_mouse_pos(event);
        let selected_obj = find_containing_obj(pos);
        if (selected_obj === null) {
             reinit_objects_state();
            return;
        }
        state.objects = {
            mode: 'moving',
            start_mouse_pos: pos,
            original_obj: Object.assign({}, selected_obj),
            obj: selected_obj,
        };
        select_obj(selected_obj);
    }

    function handle_objects_mousemove(event) {
        if (state.objects.mode !== 'moving') {
            // only wanna do this shit while the mouse is down
            return;
        }
        let pos = get_mouse_pos(event);
        let disp = grid.displacement(state.objects.start_mouse_pos, pos);
        let dimensions = grid.dimensions();
        let max_x = dimensions.width - state.objects.obj.width - 1;
        let max_y = dimensions.height - state.objects.obj.height - 1;
        console.log(max_x, max_y);
        let new_x = snap(
            state.objects.original_obj.upper_left_x + disp.x_disp,
            0, max_x);
        let new_y = snap(
            state.objects.original_obj.upper_left_y + disp.y_disp,
            0, max_y);
        move_obj(state.objects.obj, new_x, new_y);
    }

    function handle_objects_mouseup(event) {
        reinit_objects_state();
    }

    function handle_mousedown(event) {
        clear_selected_object();
        if (current_mode === 'walls') {
            handle_walls_mousedown(event);
        } else if (current_mode === 'objects') {
            handle_objects_mousedown(event);
        }
    }

    function handle_mousemove(event) {
        if (current_mode === 'walls') {
            handle_walls_mousemove(event);
        } else if (current_mode === 'objects') {
            handle_objects_mousemove(event);
        }
    }

    function handle_mouseup(event) {
        if (current_mode === 'walls') {
            handle_walls_mouseup(event);
        } else if (current_mode === 'objects') {
            handle_objects_mouseup(event);
        }
    }

    function handle_undo_add_wall(event) {
        if (walls.length === 0) {
            return;
        }
        walls.pop();
        if (walls.length === 0) {
            undo_add_wall.classList.add('hidden');
        }
        redraw();
    }

    function handle_delete_selected_object(event) {
        if (selected_object === null) {
            console.log("your state got fucked up");
            return;
        }
        let idx = drawn_objs.indexOf(selected_object);
        if (idx === -1) {
            console.log('???');
            return;
        }
        drawn_objs.splice(idx, 1);
        clear_selected_object();
        redraw();
        save_state();
    }

    function handle_rotate_selected_object(event) {
        if (selected_object === null) {
            console.log("your state got fucked up");
            return;
        }
        let h = selected_object.height;
        selected_object.height = selected_object.width;
        selected_object.width = h;
        redraw();
        save_state();
    }

    function add_obj(obj) {
        let div = document.createElement('div');
        let contents = `
        ${obj.name} (${obj.width}x${obj.height})
<button type="button" class="create-object" data-name="${obj.name}">add</button>`;
        div.innerHTML = contents;
        div.classList.add('room-object');
        objects[obj.name] = obj;
        object_inventory_div.appendChild(div);
        object_inventory_div.classList.remove('hidden');
        save_state();
    }

    function handle_add_object(event) {
        event.preventDefault();
        let width = parseInt(add_object_form.elements.width.value, 10);
        let height = parseInt(add_object_form.elements.height.value, 10);
        let name = add_object_form.elements.name.value;
        if (isNaN(width)) {
            alert('Must enter integer width');
            return;
        }
        if (isNaN(height)) {
            alert('Must enter integer height');
            return;
        }
        if (name === '') {
            alert('Must enter name');
            return;
        }
        add_obj({
            width: width,
            height: height,
            name: name,
        });
    }

    function add_drawn_obj(obj, upper_left_x=0, upper_left_y=0) {
        let ours = Object.assign({}, obj);
        ours.upper_left_x = upper_left_x;
        ours.upper_left_y = upper_left_y;
        ours.colour = OBJ_COLOUR;
        drawn_objs.push(ours);
        clear_selected_object();
        redraw();
        save_state();
    }

    function move_obj(obj, new_x, new_y) {
        obj.upper_left_x = new_x;
        obj.upper_left_y = new_y;
        redraw();
        save_state();
    }

    function create_obj(button) {
        let obj = objects[button.dataset.name];
        if (obj === undefined) {
            alert('bad object');
            return;
        }

        add_drawn_obj(obj);
    }

    function handle_create_obj(event) {
        // would it be better to add a specific closure event listener to each
        // object line as it gets created?
        if (event.target.classList.contains('create-object')) {
            create_obj(event.target);
        }
    }

    function dehydrate() {
        return JSON.stringify({
            walls: walls,
            objects: objects,
            drawn_objs: drawn_objs,
            stored_configurations: stored_configurations,
        });
    }

    // this is in-place, which is sorta gross but eh
    function hydrate(serialized) {
        currently_rehydrating = true;
        try {
            let new_state = JSON.parse(serialized);
            new_state.walls.forEach(e => add_wall(e));
            Object.values(new_state.objects).forEach(v => add_obj(v));
            new_state.drawn_objs.forEach(o =>
                add_drawn_obj({
                    name: o.name,
                    width: o.width,
                    height: o.height,
                }, o.upper_left_x, o.upper_left_y));
            Object.entries(new_state.stored_configurations).forEach(
                 entry => _store_configuration(entry[0], entry[1])
            );
            redraw();
        } finally {
            currently_rehydrating = false;
        }
    }

    function save_state() {
        if (!currently_rehydrating) {
            window.localStorage.setItem(CACHE_KEY, dehydrate());
        }
    }

    function reset_walls() {
        walls = [];
        reinit_wall_state();
        reinit_objects_state();

    }

    function reset_drawn_objects() {
        drawn_objs = [];
        redraw();
    }

    function reset_objects() {
        objects = [];
        selected_object = null;
        object_inventory_div.innerHTML = '';
    }

    function reset_configurations() {
        stored_configurations = [];
        stored_configurations_div.innerHTML = '';
    }

    function reset() {
        reset_walls();
        reset_drawn_objects();
        reset_objects();
        reset_configurations();
        currently_rehydrating = false;
        undo_add_wall.classList.add('hidden');
        redraw();
        save_state();
    }

    function handle_reset(event) {
        reset();
    }

    function handle_reset_objects(event) {
        reset_drawn_objects();
    }

    function _store_configuration(name, configuration) {
        let is_new = !stored_configurations.hasOwnProperty(name);
        stored_configurations[name] = configuration;
        if (is_new) {
            let div = document.createElement('div');
            let content = `
                <span>${name}</span>
                <button type="button" class="replace" data-name=${name}>
                    Replace existing configuration
                </button>
                <button type="button" class="remove" data-name=${name}>
                    Remove
                </button>
            `;
            div.innerHTML = content;
            div.classList.add('configuration');
            stored_configurations_div.appendChild(div);
            stored_configurations_div.classList.remove('hidden');
        }
        save_state();
    }

    function store_configuration(name) {
        let current_configuration = drawn_objs.map(
            function(o) {
                let new_o = Object.assign({}, o);
                new_o.colour = OBJ_COLOUR;
                return new_o;
            }
        );
        _store_configuration(name, current_configuration);
    }

    function handle_store_configuration(event) {
        event.preventDefault();
        let name = store_configuration_form.elements.name.value;
        if (name === '') {
            alert('Must enter name');
            return;
        }
        store_configuration(name);
    }

    function replace_configuration(el) {
        reset_drawn_objects();
        drawn_objs = stored_configurations[el.dataset.name].map(
            o => Object.assign({}, o)
        );
        store_configuration_form.elements.name.value = el.dataset.name;

        redraw();
        save_state();
    }

    function remove_configuration(el) {
        let name = el.dataset.name;
        delete stored_configurations[name];
        el.parentElement.remove();
        save_state();
    }

    function handle_stored_configurations(event) {
        event.preventDefault();
        // would it be better to add a specific closure event listener to each
        // object line as it gets created?
        if (event.target.classList.contains('replace')) {
            replace_configuration(event.target);
        } else if (event.target.classList.contains('remove')) {
            remove_configuration(event.target);
        }
    }

    this.init = function() {
        reinit_wall_state();
        reinit_objects_state();
        build_grid();
        redraw();
        let dimensions = grid.dimensions();
        grid_width_span.innerText = dimensions.width;
        grid_height_span.innerText = dimensions.height;

        buttons.addEventListener('click', handle_mode_change);
        canvas.addEventListener('mousedown', handle_mousedown);
        canvas.addEventListener('mousemove', handle_mousemove);
        canvas.addEventListener('mouseup', handle_mouseup);
        undo_add_wall.addEventListener('click', handle_undo_add_wall);
        delete_selected_object.addEventListener(
            'click', handle_delete_selected_object);
        rotate_selected_object.addEventListener(
            'click', handle_rotate_selected_object);
        add_object_form.addEventListener('submit', handle_add_object);
        object_inventory_div.addEventListener('click', handle_create_obj);
        reset_button.addEventListener('click', handle_reset);
        reset_objects_button.addEventListener('click', handle_reset_objects);
        store_configuration_form.addEventListener(
            'submit', handle_store_configuration);
        stored_configurations_div.addEventListener(
            'click', handle_stored_configurations);

        let state = window.localStorage.getItem(CACHE_KEY);
        if (state !== null) {
            hydrate(state);
        }
    }

}

document.addEventListener("DOMContentLoaded", function() {
    let canvas = document.getElementById('planner');
    planner = new RoomPlanner(canvas);
    planner.init();
});
