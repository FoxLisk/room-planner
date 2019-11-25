"use strict";

function assert(val, msg) {
    if (!val) {
        alert('assertion error: ' + msg + ' \n (' + val + ')');
    }
}

function Grid(canvas, corner_offset, dot_radius, dot_spacing) {
    var points = null;
    var dot_radius = dot_radius;

    // TODO: context.scale might be a better way of dealing with this
    var dot_spacing = dot_spacing;
    // N.B. context.translate seems unlikely to be an improvement for the
    // corner offset, since i want an offset on *each* corner.
    var corner_offset = corner_offset;
    const w = canvas.getAttribute('width');
    const h = canvas.getAttribute('height');
    const xstart = corner_offset + dot_radius;
    const xend = w - corner_offset - dot_radius;
    const ystart = corner_offset + dot_radius;
    const yend = h - corner_offset - dot_radius;

    function init() {
        points = [];
        for (var x = xstart; x < xend; x += dot_spacing) {
            var cur_row = [];
            for (var y = ystart; y < yend; y += dot_spacing) {
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
        var point = points[x][y]
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
        var point = points[dot.x_coord][dot.y_coord];
        return {
            x: point.x,
            y: point.y,
        };
    }

    // take x, y as position on canvas, return x, y s.t. points[x][y] is
    // nearest point
    this.find_closest_dot = function(pos) {
        var closest = points[0];
        var scaled_x = scale(pos.x);
        var scaled_y = scale(pos.y);
        return {
            x_coord: scaled_x,
            y_coord: scaled_y,
        }

    }

    this.colour_dot = function(dot_coords, colour) {
        var dot = points[dot_coords.x_coord][dot_coords.y_coord];
        if (dot.colour !== colour) {
            dot.colour = colour;
        }
    }

    this.draw = function(ctx) {
        for (var i = 0; i < points.length; i++) {
            for (var j = 0; j < points[i].length; j++) {
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
        var x_disp = scale(to.x) - scale(from.x);
        var y_disp = scale(to.y) - scale(from.y);
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

function RoomPlanner(canvas) {
    var canvas = canvas;
    var ctx = canvas.getContext('2d');

    const buttons = document.getElementById('buttons');
    const undo_add_wall = document.getElementById('undo-add-wall');
    const mode_span = document.getElementById('current-mode');
    const grid_width_span = document.getElementById('grid-width');
    const grid_height_span = document.getElementById('grid-height');
    const add_object_form = document.getElementById('add-object');
    const object_inventory_div = document.getElementById('object-inventory');


    const CORNER_OFFSET = 10;
    const w = canvas.getAttribute('width');
    const h = canvas.getAttribute('height');
    const DOT_RAD = 2;
    const DOT_SPACING = 16;
    const WALL_COLOUR = '#00FF00';
    const OBJ_COLOUR = '#0000FF';

    var grid = null;

    var current_mode = null;
    var state = {
    };

    var walls = [];
    var objects = [];
    var drawn_objs = [];

    // stolen from https://stackoverflow.com/a/33063222
    function get_mouse_pos(evt) {
        var rect = canvas.getBoundingClientRect();
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
        var dx = Math.abs(end.x_coord - start.x_coord);
        var dy = Math.abs(end.y_coord - start.y_coord);
        var true_end = {
            x_coord: end.x_coord,
            y_coord: end.y_coord,
        }
        if (dx < dy) {
            true_end.x_coord = start.x_coord;
        } else {
            true_end.y_coord = start.y_coord;
        }
        var start_coords = grid.canvas_coords(start);
        var end_coords = grid.canvas_coords(true_end);

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
        for (var i = 0; i < walls.length; i++) {
            draw_wall(walls[i].start, walls[i].end);
        }
    }

    function draw_obj(obj) {
        var lx = obj.upper_left_x;
        var uy = obj.upper_left_y;
        var rx = lx + obj.width;
        var by = uy + obj.height;

        var ul = {
            x_coord: lx,
            y_coord: uy,
        };
        var ur = {
            x_coord: rx,
            y_coord: uy,
        };
        var bl = {
            x_coord: lx,
            y_coord: by,
        };
        var br = {
            x_coord: rx,
            y_coord: by,
        };
        draw_wall(ul, ur, OBJ_COLOUR);
        draw_wall(ur, br, OBJ_COLOUR);
        draw_wall(br, bl, OBJ_COLOUR);
        draw_wall(bl, ul, OBJ_COLOUR);
        var upper_left_canvas = grid.canvas_coords(ul);
        var bottom_left_canvas = grid.canvas_coords(bl);
        var name_y = (bottom_left_canvas.y + upper_left_canvas.y) / 2
        var name_x = upper_left_canvas.x + DOT_RAD

        ctx.fillText(obj.name, name_x, name_y, DOT_SPACING * obj.width - 2 * DOT_RAD);

        // make dots in the furniture interior less obtrusive
        for (var x = ul.x_coord + 1; x < ur.x_coord; x++) {
            for (var y = ul.y_coord + 1; y < bl.y_coord; y++) {
                grid.colour_dot({
                    x_coord: x,
                    y_coord: y,
                }, '#dddddd');

            }
        }
    }

    function draw_objs() {
        for (var i = 0; i < drawn_objs.length; i++) {
            var obj = drawn_objs[i];
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

    function highlight_nearest_dot(event) {
        var pos = get_mouse_pos(event);
        var dot = grid.find_closest_dot(pos);
        grid.colour_dot(dot, '#FF0000');
        redraw();
    }

    function set_mode(mode) {
        mode_span.innerHTML = mode;
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
    }

    function handle_walls_mousedown(event) {
        if (state.walls.mode !== 'start') {
            alert('bad wall state');
        }
        var pos = get_mouse_pos(event);
        var dot = grid.find_closest_dot(pos);
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
        var pos = get_mouse_pos(event);
        var end = grid.find_closest_dot(pos);
        redraw();
        draw_wall(state.walls.start_dot, end);
    }

    function handle_walls_mouseup(event) {
        if (state.walls.mode !== 'drawing') {
            alert('bad wall state');
        }
        var pos = get_mouse_pos(event);
        var end = grid.find_closest_dot(pos);
        var wall = draw_wall(state.walls.start_dot, end);
        add_wall(wall);
        reinit_wall_state();
    }

    function find_containing_obj(pos) {
        // TODO
        return drawn_objs[0];
    }

    function handle_objects_mousedown(event) {
        if (state.objects.mode !== 'start') {
            alert('bad objects state');
            return;
        }
        var pos = get_mouse_pos(event);
        var selected_obj = find_containing_obj(pos);
        state.objects = {
            mode: 'moving',
            start_mouse_pos: pos,
            original_obj: Object.assign({}, selected_obj),
            obj: selected_obj,
        };
    }

    function handle_objects_mousemove(event) {
        if (state.objects.mode !== 'moving') {
            // only wanna do this shit while the mouse is down
            return;
        }
        var pos = get_mouse_pos(event);
        var disp = grid.displacement(state.objects.start_mouse_pos, pos);
        state.objects.obj.upper_left_x = state.objects.original_obj.upper_left_x +  disp.x_disp;
        state.objects.obj.upper_left_y = state.objects.original_obj.upper_left_y +  disp.y_disp;
        redraw();
    }

    function handle_objects_mouseup(event) {
        if (state.objects.mode !== 'moving') {
            alert('bad objects state');
            return;
        }
        state.objects = {
            mode: 'start',
        };
    }

    function handle_mousedown(event) {
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

    function add_obj(obj) {
        var div = document.createElement('div');
        var contents = `
        ${obj.name} (${obj.width}x${obj.height})
<button type="button" class="create-object" data-name="${obj.name}">add</button>`;
        div.innerHTML = contents;
        div.classList.add('room-object');
        objects[obj.name] = obj;
        object_inventory_div.appendChild(div);
        object_inventory_div.classList.remove('hidden');
    }

    function handle_add_object(event) {
        event.preventDefault();
        var width = parseInt(add_object_form.elements.width.value, 10);
        var height = parseInt(add_object_form.elements.height.value, 10);
        var name = add_object_form.elements.name.value;
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

    function add_drawn_obj(obj) {
        var ours = Object.assign({}, obj);
        ours.upper_left_x = 0;
        ours.upper_left_y = 0;
        drawn_objs.push(ours);
        redraw();
    }

    function create_obj(button) {
        var obj = objects[button.dataset.name];
        if (obj === undefined) {
            alert('bad object');
            return;
        }

        var buttons = object_inventory_div.getElementsByClassName(
            'create-object');
        for (var i = 0; i < buttons.length; i++) {
            buttons[i].disabled = true;
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

    this.init = function() {
        reinit_wall_state();
        reinit_objects_state();
        build_grid();
        redraw();
        var dimensions = grid.dimensions();
        grid_width_span.innerText = dimensions.width;
        grid_height_span.innerText = dimensions.height;

        buttons.addEventListener('click', handle_mode_change);
        canvas.addEventListener('mousedown', handle_mousedown);
        canvas.addEventListener('mousemove', handle_mousemove);
        canvas.addEventListener('mouseup', handle_mouseup);
        undo_add_wall.addEventListener('click', handle_undo_add_wall);
        add_object_form.addEventListener('submit', handle_add_object);
        object_inventory_div.addEventListener('click', handle_create_obj);

        add_obj({
            name:'bed',
            width:4,
            height:3,
        });
    }

}

document.addEventListener("DOMContentLoaded", function() {
    var canvas = document.getElementById('planner');
    planner = new RoomPlanner(canvas);
    planner.init();
});
