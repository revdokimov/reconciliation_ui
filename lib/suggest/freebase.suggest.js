;(function($, undefined){

if (!window.console) {
    window.console = {};
}
if (!window.console.log) {
    window.console.log = function() {};
}

$.suggest = function(name, prototype) {

    $.fn[name] = function(options) {
        var isMethodCall = (typeof options === 'string'),
        args = Array.prototype.slice.call(arguments, 1);

        return this.each(function() {
                var instance = $.data(this, name);
                if (instance) {
                    instance._destroy();
                }
                // TODO: if instance and isMethodCall: instance[method].apply
                $.data(this, name, new $.suggest[name](this, options))._init();
            });
    };

    $.suggest[name] = function(input, options) {

        var self = this;

        this.name = name;

        var o = this.options = $.extend(true, {},
                                        $.suggest.defaults,
                                        $.suggest[name].defaults,
                                        options),

        // update css names
        p = o.css_prefix = o.css_prefix || "",
        css = o.css;
        $.each(css, function(k, v) {
                css[k] = p + css[k];
            });

        // suggest parameters
        o.ac_param = {};
        $.each(["type", "type_strict", "mql_filter", "as_of_time"], function(i,n) {
                var v = o[n];
                if (v === null || v === "") {
                    return;
                }
                if (typeof v === "object") {
                    if (typeof JSON === "undefined") {
                        init_JSON();
                    }
                    v = JSON.stringify(v);
                }
                o.ac_param[n] = v;
            });

        // status texts
        this._status = {
            START: "",
            LOADING: "",
            SELECT: ""
        };
        if (o.status && o.status instanceof Array && o.status.length == 3) {
            this._status.START = o.status[0] || "";
            this._status.LOADING = o.status[1] || "";
            this._status.SELECT = o.status[2] || "";
        }

        // create the container for the drop down list
        var l = this.list = $('<ul class="' + css.list + '">'),
        h = '<div style="display:none;" class="fbs-reset ' + css.pane + '">',
        s = this.status = $('<div style="display:none;" class="' + css.status + '">'),
        p = this.pane = $(h).append(s).append(l);


        if (o.parent) {
            $(o.parent).append(p);
        }
        else {
            p.css("position","absolute");
            $(document.body).append(p);
        }
        p.bind("mousedown", function(e) {
                //console.log("pane mousedown");
                self.dont_hide = true;
                e.stopPropagation();
            })
        .bind("mouseup", function(e) {
                //console.log("pane mouseup");
                if (self.dont_hide) {
                    self.input.focus();
                }
                self.dont_hide = false;
                e.stopPropagation();
            })
        .bind("click", function(e) {
                //console.log("pane click");
                e.stopPropagation();
                var s = self.get_selected();
                if (s) {
                    self.onselect(s, true);
                    self.hide_all();
                }
            });

        var hoverover = function(e) {
            self.hoverover_list(e);
        };
        var hoverout = function(e) {
            self.hoverout_list(e);
        };
        l.hover(hoverover, hoverout);


        //console.log(this.pane, this.list);

        this.input = $(input)
        .attr("autocomplete", "off")
        .unbind(".suggest")
        .bind("keydown.suggest", function(e) {
                self.keydown(e);
            })
        .bind("keypress.suggest", function(e) {
                self.keypress(e);
            })
        .bind("keyup.suggest", function(e) {
                self.keyup(e);
            })
        .bind("blur.suggest", function(e) {
                self.blur(e);
            })
        .bind("textchange.suggest", function(e) {
                self.textchange();
            })
        .bind("focus.suggest", function(e) {
                self.focus(e);
            })
        .bind("input.suggest", function(e) {
                self.textchange();
            });

        // resize handler
        this.onresize = function(e) {
            self.invalidate_position();
            if (p.is(":visible")) {
                self.position();
                if (o.flyout && self.flyoutpane && self.flyoutpane.is(":visible")) {
                    var s = self.get_selected();
                    if (s) {
                        self.flyout_position(s);
                    }
                }
            }
        };

        $(window)
            .bind("resize.suggest", this.onresize)
            .bind("scroll.suggest", this.onresize);
    };

    $.suggest[name].prototype = $.extend({}, $.suggest.prototype, prototype);
};

// base suggest prototype
$.suggest.prototype = {

    _init: function() {},

    _destroy: function() {
        this.pane.remove();
        this.list.remove();
        this.input.unbind(".suggest");
        $(window).unbind("resize.suggest", this.onresize)
            .unbind("scroll.suggest", this.onresize);
    },

    invalidate_position: function() {
        self._position = null;
    },

    status_start: function() {
        this.hide_all();
        this.status.siblings().hide();
        if (this._status.START) {
            this.status.text(this._status.START).show();
            if (!this.pane.is(":visible")) {
                this.position();
                this.pane_show();
            }
        }
        if (this._status.LOADING) {
            this.status.removeClass("loading");
        }
    },

    status_loading: function() {
        this.status.siblings().show();

        if (this._status.LOADING) {
            this.status.addClass("loading")
                .text(this._status.LOADING).show();
            if (!this.pane.is(":visible")) {
                this.position();
                this.pane_show();
            }
        }
        else {
            this.status.hide();
        }
    },

    status_select: function() {
        this.status.siblings().show();
        if (this._status.SELECT) {
            this.status.text(this._status.SELECT).show();
        }
        else {
            this.status.hide();
        }
        if (this._status.LOADING) {
            this.status.removeClass("loading");
        }
    },

    focus: function(e) {
        //console.log("focus", $.trim(this.input.val()) === "");
        var o = this.options;
        if ($.trim(this.input.val()) === "") {
            this.status_start();
        }
        else {
            this.focus_hook(e);
        }
    },

    // override to be notified on focus and input has a value
    focus_hook: function(e) {
        //console.log("focus_hook", this.input.data("data.suggest"));
        if (!this.input.data("data.suggest") &&
            !this.pane.is(":visible") &&
            $("." + this.options.css.item, this.list).length) {
            this.position();
            this.pane_show();
        }
    },

    keydown: function(e) {
        var key = e.keyCode;
        if (key === 9) { // tab
            this.tab(e);
        }
        else if (key === 38 || key === 40) { // up/down
            if (!e.shiftKey) {
                // prevents cursor/caret from moving (in Safari)
                e.preventDefault();
            }
        }
    },

    keypress: function(e) {
        var key = e.keyCode;
        if (key === 38 || key === 40) { // up/down
            if (!e.shiftKey) {
                // prevents cursor/caret from moving
                e.preventDefault();
            }
        }
        else if (key === 13) { // enter
            this.enter(e);
        }
        else if (key === 27) { // escape
            this.escape(e);
        }
        else if ((e.metaKey || e.ctrlKey) && e.charCode === 118) {
            window.clearTimeout(this.keypress.timeout);
            var self = this;
            this.keypress.timeout = window.setTimeout(function() {self.textchange();}, 0);
        }
    },

    keyup: function(e) {
        var key = e.keyCode;
        //console.log("keyup", key);
        if (key === 38) { // up
            e.preventDefault();
            this.up(e);
        }
        else if (key === 40) { // down
            e.preventDefault();
            this.down(e);
        }
        else if (e.ctrlKey && key === 77) {
            $(".fbs-more-link", this.pane).click();
        }

        else if ($.suggest.is_char(e)) {
            //this.textchange();
            window.clearTimeout(this.keypress.timeout);
            var self = this;
            this.keypress.timeout = window.setTimeout(function() {self.textchange();}, 0);
        }

        return true;
    },

    blur: function(e) {
        //console.log("blur dont_hide", this.dont_hide);
        if (this.dont_hide) {
            return;
        }
        var data = this.input.data("data.suggest");
        //console.log("blur data", data);
        if (!data) {
            this.check_required(e);
        }
        this.hide_all();
    },

    tab: function(e) {
        if (e.shiftKey || e.metaKey || e.ctrlKey) {
            return;
        }

        var o = this.options,
        visible = this.pane.is(":visible") && $("." + o.css.item, this.list).length,
        s = this.get_selected();

        //console.log("tab", visible, s);

        if (visible && s) {
            this.onselect(s);
            this.hide_all();
        }
    },

    enter: function(e) {
        var o = this.options,
        visible = this.pane.is(":visible");

        //console.log("enter", visible);

        if (visible) {
            if (e.shiftKey) {
                this.shift_enter(e);
                e.preventDefault();
            }
            else if ($("." + o.css.item, this.list).length) {
                var s = this.get_selected();
                if (s) {
                    this.onselect(s);
                    this.hide_all();
                    e.preventDefault();
                }
                else {
                    var data = this.input.data("data.suggest");
                    if (o.soft) {
                        if (!data) {
                            this.check_required(e);
                        }
                    }
                    else {
                        if ($("."+this.options.css.item + ":visible", this.list).length) {
                            this.updown(false);
                            e.preventDefault();
                        }
                        else if (!data) {
                            this.check_required(e);
                        }
                    }
                }
            }
            //console.log("enter preventDefault");
        }
    },

    shift_enter: function(e) {},

    escape: function(e) {
        this.hide_all();
    },

    up: function(e) {
        //console.log("up");
        this.updown(true, e.ctrlKey || e.shiftKey);
    },

    down: function(e) {
        //console.log("up");
        this.updown(false, null, e.ctrlKey || e.shiftKey);
    },

    updown: function(goup, gofirst, golast) {
        //console.log("updown", goup, gofirst, golast);
        var inp = this.input,
        o = this.options,
        css = o.css,
        p = this.pane,
        l = this.list;

        if (!p.is(":visible")) {
            if (!goup) {
                this.textchange();
            }
            return;
        }
        var li = $("."+css.item + ":visible", l);

        if (!li.length) {
            return;
        }

        var first = $(li[0]),
        last = $(li[li.length-1]),
        cur = this.get_selected() || [],
        orig = inp.data("original.suggest"),
        prev = next = data = undefined;

        window.clearTimeout(this.ignore_mouseover.timeout);
        this._ignore_mouseover = false;

        if (goup) {
            if (gofirst) {
                first.trigger("mouseover.suggest");
                data = first.data("data.suggest");
                if (data) {
                    inp.val(data.name);
                }
                else {
                    inp.val(orig);
                    this.hoverout_list();
                }
                this.scroll_to(first);
            }
            else if (!cur.length) {
                last.trigger("mouseover.suggest");
                data = last.data("data.suggest");
                if (data) {
                    inp.val(data.name);
                }
                else {
                    inp.val(orig);
                    this.hoverout_list();
                }
                this.scroll_to(last);
            }
            else if (cur[0] == first[0]) {
                first.removeClass(css.selected);
                inp.val(orig);
                this.hoverout_list();
            }
            else {
                prev = cur.prevAll("."+css.item + ":visible:first").trigger("mouseover.suggest");
                data = prev.data("data.suggest");
                if (data) {
                    inp.val(data.name);
                }
                else {
                    inp.val(orig);
                    this.hoverout_list();
                }
                this.scroll_to(prev);
            }
        }
        else {
            if (golast) {
                last.trigger("mouseover.suggest");
                data = last.data("data.suggest");
                if (data) {
                    inp.val(data.name);
                }
                else {
                    inp.val(orig);
                    this.hoverout_list();
                }
                this.scroll_to(last);
            }
            else if (!cur.length) {
                first.trigger("mouseover.suggest");
                data = first.data("data.suggest");
                if (data) {
                    inp.val(data.name);
                }
                else {
                    inp.val(orig);
                    this.hoverout_list();
                }
                this.scroll_to(first);
            }
            else if (cur[0] == last[0]) {
                last.removeClass(css.selected);
                inp.val(orig);
                this.hoverout_list();
            }
            else {
                next = cur.nextAll("."+css.item + ":visible:first").trigger("mouseover.suggest");
                data = next.data("data.suggest");
                if (data) {
                    inp.val(data.name);
                }
                else {
                    inp.val(orig);
                    this.hoverout_list();
                }
                this.scroll_to(next);
            }
        }
    },

    scroll_to: function(item) {
        var l = this.list,
        scrollTop = l.scrollTop(),
        scrollBottom = scrollTop + l.innerHeight(),
        item_height = item.outerHeight(),
        offsetTop = item.prevAll().length * item_height,
        offsetBottom = offsetTop + item_height;
        if (offsetTop < scrollTop) {
            this.ignore_mouseover();
            l.scrollTop(offsetTop);
        }
        else if (offsetBottom > scrollBottom) {
            this.ignore_mouseover();
            l.scrollTop(scrollTop + offsetBottom - scrollBottom);
        }
    },

    textchange: function() {
        this.input.removeData("data.suggest");
        this.input.trigger("fb-textchange", this);
        var val = $.trim(this.input.val());
        if (val === "") {
            this.status_start();
            return;
        }
        else {
            this.status_loading();
        }
        this.request(val);
    },

    request: function(val) {
        calls = this.input.data("request.count.suggest");
        if (!calls) {
            this.trackEvent(this.name, "start_session");
            calls = 0;
        }
        calls += 1;
        this.trackEvent(this.name, "request", "count", calls);
        this.input.data("request.count.suggest", calls);
    },

    response: function(data) {
        if ("cost" in data) {
            this.trackEvent(this.name, "response", "cost", data.cost);
        }

        if (!this.check_response(data)) {
            return;
        }
        var result = [];

        if ($.isArray(data)) {
            result = data;
        }
        else if ("result" in data) {
            result = data.result;
        }

        var args = $.map(arguments, function(a) {
                return a;
            });

        this.response_hook.apply(this, args);

        var first = null,
        self = this,
        o = this.options;

        $.each(result, function(i,n) {
                var li = self.create_item(n, data)
                    .bind("mouseover.suggest", function(e) {
                              self.mouseover_item(e);
                          })
                    .data("data.suggest", n);
                self.list.append(li);
                if (i === 0) {
                    first = li;
                }
            });

        this.input.data("original.suggest", this.input.val());


        if ($("."+o.css.item, this.list).length === 0) {
            var $nomatch = $('<li class="nomatch">' + o.nomatch + '</li>')
                .bind("click.suggest", function(e) {
                        e.stopPropagation();
                        //                    self.input.focus();
                    });
            this.list.append($nomatch);
        }

        args.push(first);
        this.show_hook.apply(this, args);
        this.position();
        this.pane_show();
    },

    pane_show: function() {
        if (!this.pane.is(":visible")) {
            if (this.options.animate) {
                this.pane.slideDown("fast");
            }
            else {
                this.pane.show();
            }
        }
        this.input.trigger("fb-pane-show", this);
    },

    create_item: function(data, response_data) {
        var css = this.options.css;
        li = $('<li class="' + css.item + '">');
        var label = $("<label>").text(data.name);
        data.name = label.text();
        li.append($('<div class="' + css.item_name + '">').append(label));
        return li;
    },

    mouseover_item: function(e) {
        if (this._ignore_mouseover) {
            return;
        }
        var target = e.target;
        if (target.nodeName.toLowerCase() !== "li") {
            target = $(target).parents("li:first");
        }
        var li = $(target),
        css = this.options.css,
        l = this.list;
        $("."+css.item, l)
            .each(function() {
                if (this !== li[0]) {
                    $(this).removeClass(css.selected);
                }
            });
        if (!li.hasClass(css.selected)) {
            li.addClass(css.selected);
            this.mouseover_item_hook(li);
        }
    },

    mouseover_item_hook: function($li) {},

    hoverover_list: function(e) {},

    hoverout_list: function(e) {},

    check_response: function(response_data) {
        return true;
    },

    response_hook: function(response_data) {
        //this.pane.hide();
        this.list.empty();
    },

    show_hook: function(response_data) {
        // remove anything next to list - added by other suggest plugins
        this.status_select();
    },

    position: function() {
        var p  = this.pane,
        o = this.options;

        if (o.parent) {
            return;
        }

        if (!self._position) {
            var inp = this.input,
            pos = inp.offset(),
            input_width = inp.outerWidth(true),
            input_height = inp.outerHeight(true);
            pos.top += input_height;

            // show to calc dimensions
            var pane_width = p.outerWidth(),
            pane_height = p.outerHeight(),
            pane_right = pos.left + pane_width,
            pane_bottom = pos.top + pane_height,
            pane_half = pos.top + pane_height / 2,
            scroll_left =  $(window).scrollLeft(),
            scroll_top =  $(window).scrollTop(),
            window_width = $(window).width(),
            window_height = $(window).height(),
            window_right = window_width + scroll_left,
            window_bottom = window_height + scroll_top;


            // is input left or right side of window?
            var left = true;
            if ('left' == o.align ) {
                left = true;
            }
            else if ('right' == o.align ) {
                left = false;
            }
            else if (pos.left > (scroll_left + window_width/2)) {
                left = false;
            }
            if (!left) {
                left = pos.left - (pane_width - input_width);
                if (left > scroll_left) {
                    pos.left = left;
                }
            }

            if (pane_half > window_bottom) {
                // can we see at least half of the list?
                var top = pos.top - input_height - pane_height;
                if (top > scroll_top) {
                    pos.top = top;
                }
            }
            this._position = pos;
        }
        p.css({top:this._position.top, left:this._position.left});
    },

    ignore_mouseover: function(e) {
        this._ignore_mouseover = true;
        var self = this;
        this.ignore_mouseover.timeout = window.setTimeout(function() { self.ignore_mouseover_reset();}, 1000);
    },

    ignore_mouseover_reset: function() {
        this._ignore_mouseover = false;
    },

    get_selected: function() {
        var selected = null,
        select_class = this.options.css.selected;
        $("li", this.list)
            .each(function() {
                var $this = $(this);
                if ($this.hasClass(select_class) && $this.is(":visible")) {
                    selected = $this;
                    return false;
                }
            });
        return selected;
    },

    onselect: function($selected, focus) {
        var data = $selected.data("data.suggest");
        if (data) {
            this.input.val(data.name)
                .data("data.suggest", data)
                .trigger("fb-select", data);

            this.trackEvent(this.name, "fb-select", "index", $selected.prevAll().length);
        }
        else {
            //this.check_required();
        }
        if (focus) {
            //          this.input.focus();
        }
    },

    trackEvent: function(category, action, opt_label, opt_value) {
        if (this.options.trackEvent) {
            this.options.trackEvent(category, action, opt_label, opt_value)
        }
        //console.log("trackEvent", category, action, opt_label, opt_value);
    },

    check_required: function(e) {
        var required = this.options.required;
        if (required === true) {
            if (!$.trim(this.input.val())) {
              this.input.trigger("fb-required", {domEvent:e});
                return false;
            }
        }
        else if (required === "always") {
          this.input.trigger("fb-required", {domEvent:e});
            return false;
        }
        return true;
    },

    hide_all: function(e) {
        this.pane.hide();
        this.input.trigger("fb-pane-hide", this);
    }

};


$.extend($.suggest, {

             defaults: {

                 status: ['Start typing to get suggestions...',
                          'Searching...',
                          'Select an item from the list:'],

                 /*
                  *  values can be false, true, 'always'
                  *  if false, don't trigger fb-required
                  *  if true, trigger fb-required on blur if nothing selected and input val is not empty
                  *  if 'always', trigger fb-required on blur if nother selected (even if input val is empty
                  */
                 required: false,

                /*
                 * Carry over from previous freebaseSuggest to enable search box behavior without selecting an
                 * item from the list.
                 *
                 * Soft suggestion. If true, DO NOT auto-select first item on ENTER key. Otherwise, select first item. Default is false.
                 */
                 soft: false,

                 nomatch: "no matches",

                 // CSS default class names
                 css: {
                     pane: "fbs-pane",                    // outer pane of suggestion list <div>
                     list: "fbs-list",                    // suggestion list               <ul>
                     item: "fbs-item",                    // suggestion list item          <li>
                     item_name: "fbs-item-name",
                     selected: "fbs-selected",            // list item class on mouseover
                     status: "fbs-status"
                 },

                 /*
                  * css prefix that is prepended to the top level container classes
                  * (fbs-pane and fbs-flyout-pane)
                  *  i.e. if css_prefix="foo-" then pane class is "foo-fbs-pane"
                  */
                css_prefix: null,

                // http://code.google.com/apis/analytics/docs/gaJS/gaJSApi.html#_gat.GA_EventTracker_.trackEvent
                trackEvent: null,

                // jQuery selector to specify where the suggest list will be appended to (defaults to document.body).
                parent: null,

                // option to animate suggest list when shown
                animate: true
             },

             $$: function(cls, ctx) {
                 /**
                  * helper for class selector
                  */
                 return $("." + cls, ctx);
             },

             use_jsonp: function(service_url) {
                 /*
                  * if we're on the same host, then we don't need to use jsonp.
                  * This greatly increases our cachability
                  */
                 if (!service_url) {
                     return false;             // no host == same host == no jsonp
                 }

                 var pathname_len = window.location.pathname.length;
                 var hostname = window.location.href;
                 hostname = hostname.substr(0, hostname.length - pathname_len);
                 //console.log("Hostname = ", hostname);
                 if (hostname === service_url) {
                     return false;
                 }
                 return true;
             },

             strongify: function(str, substr) {
                 // safely markup substr within str with <strong>
                 var strong = str;
                 var index = str.toLowerCase().indexOf(substr.toLowerCase());
                 if (index >= 0) {
                     var substr_len = substr.length;
                     strong = $("<div>").text(str.substring(0, index))
                         .append($("<strong>").text(str.substring(index, index + substr_len)))
                         .append(document.createTextNode(str.substring(index + substr_len)))
                         .html();
                 }
                 return strong;
             },

             keyCode: {
                 //BACKSPACE: 8,
                 CAPS_LOCK: 20,
                 //COMMA: 188,
                 CONTROL: 17,
                 //DELETE: 46,
                 DOWN: 40,
                 END: 35,
                 ENTER: 13,
                 ESCAPE: 27,
                 HOME: 36,
                 INSERT: 45,
                 LEFT: 37,
                 //NUMPAD_ADD: 107,
                 //NUMPAD_DECIMAL: 110,
                 //NUMPAD_DIVIDE: 111,
                 NUMPAD_ENTER: 108,
                 //NUMPAD_MULTIPLY: 106,
                 //NUMPAD_SUBTRACT: 109,
                 PAGE_DOWN: 34,
                 PAGE_UP: 33,
                 //PERIOD: 190,
                 RIGHT: 39,
                 SHIFT: 16,
                 SPACE: 32,
                 TAB: 9,
                 UP: 38,
                 OPTION: 18,
                 APPLE: 224
             },

             is_char: function(e) {
                 if (e.type === "keypress") {
                     if ((e.metaKey || e.ctrlKey) && e.charCode === 118) { // ctrl+v
                         return true;
                     }
                     else if ("isChar" in e) {
                         return e.isChar;
                     }
                 }
                 else {
                     var not_char = $.suggest.keyCode.not_char;
                     if (!not_char) {
                         not_char = {};
                         $.each($.suggest.keyCode, function(k,v) {
                                    not_char[''+v] = 1;
                                });
                         $.suggest.keyCode.not_char = not_char;
                     }
                     return !(('' + e.keyCode) in not_char);
                 }
             }
         });


// some base implementation that we overwrite but want to call
var base = {
    _destroy: $.suggest.prototype._destroy,
    request: $.suggest.prototype.request,
    show_hook: $.suggest.prototype.show_hook
};


// *THE* Freebase suggest implementation
$.suggest("suggest", {
        _init: function() {
            var self = this,
                o = this.options;
            if (!o.flyout_service_url) {
                o.flyout_service_url = o.service_url;
            }
            this.jsonp = $.suggest.use_jsonp(o.service_url);

            if (!$.suggest.cache) {
                $.suggest.cache = {};
            }

            if (o.flyout) {
                this.flyoutpane = $('<div style="display:none;position:absolute" class="fbs-reset ' + o.css_prefix + o.css.flyoutpane + '">');
                $(document.body).append(this.flyoutpane);
                var hoverover = function(e) {
                    self.hoverover_list(e);
                };
                var hoverout = function(e) {
                    self.hoverout_list(e);
                };
                this.flyoutpane.hover(hoverover, hoverout)
                    .bind("mousedown.suggest", function(e) {
                            e.stopPropagation();
                            self.pane.click();
                        });

                if (!$.suggest.flyout) {
                    $.suggest.flyout = {};
                }
                if (!$.suggest.flyout.cache) {
                    $.suggest.flyout.cache = {};
                }
            }
        },

        _destroy: function() {
            base._destroy.call(this);
            if (this.flyoutpane) {
                this.flyoutpane.remove();
            }
        },

        shift_enter: function(e) {
            if (this.options.suggest_new) {
                this.suggest_new();
                this.hide_all();
            }
            else {
                this.check_required(e);
            }
        },

        hide_all: function(e) {
            this.pane.hide();
            if (this.flyoutpane) {
                this.flyoutpane.hide();
            }
            this.input.trigger("fb-pane-hide", this);
        },

        request: function(val, start) {
            var self = this,
                o = this.options;

            base.request.call(self);

            if (this.ac_xhr) {
                this.ac_xhr.abort();
                this.ac_xhr = null;
            }
            var data = {
                prefix: val
            };
            if (start) {
                data.start = start;
            }

            $.extend(data, o.ac_param);

            var url = o.service_url + o.service_path + "?" + $.param(data),
            cached = $.suggest.cache[url];
            if (cached) {
                this.response(cached, start ? start : -1);
                return;
            }

            window.clearTimeout(this.request.timeout);
            this.request.timeout =
                window.setTimeout(function() {
                                      self.ac_xhr = $.ajax({
                                                               "type": "GET",
                                                               "url": o.service_url + o.service_path,
                                                               "data": data,
                                                               "success": function(data, status) {
                                                                   $.suggest.cache[url] = data;
                                                                   self.response(data, start ? start : -1);
                                                               },
                                                               "error": function(xhr, s, ex) {
                                                                   self.trackEvent(self.name, "request", "error", {url:this.url, response:xhr.responseText});
                                                               },
                                                               "dataType": self.jsonp ? "jsonp" : "json",
                                                               "cache": true
                                                           });
                                      }, 200);
        },

        create_item: function(data, response_data) {
            var css = this.options.css,
                classs = [css.item];
            if ("class" in data) {
                classs.push(data["class"]);
            }
            var li =  $('<li class="' + classs.join(" ") + '">');

            var name = $('<div class="' + css.item_name + '"><label>' + $.suggest.strongify(data.name, response_data.prefix) + '</label></div>');
            data.name = name.text();
            li.append(name);
            if (data.type && data.type.length) {
                var notable_type = data['notable:type'] || data.type[0]['id'] || '/common/topic';
                var types = [];
                $.each(data.type, function(i,t) {
                        if (notable_type == t['id']) {
                            types.push(t['name']);
                            return false;
                        }
                    });
                name.prepend($('<div class="' + css.item_type + '">').text(types.join(", ")));
            }

            //console.log("create_item", li);
            return li;
        },


        mouseover_item_hook: function(li) {
            var data = li.data("data.suggest");
            if (this.options.flyout) {
                if (data) {
                    this.flyout_request(data);
                }
                else {
                    //this.flyoutpane.hide();
                }
            }
        },

        check_response: function(response_data) {
            return response_data.prefix === $.trim(this.input.val());
        },

        response_hook: function(response_data, start) {
            if (this.flyoutpane) {
                this.flyoutpane.hide();
            }
            if (start > 0) {
                $(".fbs-more", this.pane).remove();
            }
            else {
                //this.pane.hide();
                this.list.empty();
            }
        },

        show_hook: function(response_data, start, first) {
            base.show_hook.apply(this, [response_data]);

            var o = this.options,
                self = this,
                p = this.pane,
                l = this.list,
                result = response_data.result;

            var more = $(".fbs-more", p),
                suggestnew = $(".fbs-suggestnew", p);


            // more
            if (result && result.length && "start" in response_data) {
                if (!more.length) {
                    var more_link = $('<a class="fbs-more-link" href="#" title="(Ctrl+m)">view more</a>');
                    more = $('<div class="fbs-more">').append(more_link);
                    more_link
                        .bind("click.suggest", function(e) {
                                e.preventDefault();
                                e.stopPropagation();
                                var m = $(this).parent(".fbs-more");
                                self.more(m.data("start.suggest"));
                            });
                    l.after(more);
                }
                more.data("start.suggest", response_data.start);
                more.show();
            }
            else {
                more.remove();
            }

            // suggest_new
            if (o.suggest_new) {
                if (!suggestnew.length) {
                    // create suggestnew option
                    var button = $('<button class="fbs-suggestnew-button">');
                    button.text(o.suggest_new);
                    suggestnew = $('<div class="fbs-suggestnew">')
                        .append('<div class="fbs-suggestnew-description">Your item not in the list?</div>')
                        .append(button)
                        .append('<span class="fbs-suggestnew-shortcut">(Shift+Enter)</span>')
                        .bind("click.suggest", function(e) {
                                e.stopPropagation();
                                self.suggest_new(e);
                            });
                    p.append(suggestnew);
                }
                suggestnew.show();
            }
            else {
                suggestnew.remove();
            }

            // scroll to first if clicked on "more"
            if (first && first.length && start > 0) {
                var top = first.prevAll().length * first.outerHeight();
                var scrollTop = l.scrollTop();
                l.animate({scrollTop: top}, "slow",
                          function(){ first.trigger("mouseover.suggest");});
            }
        },

        suggest_new: function(e) {
            var val = $.trim(this.input.val());
            if (!val) {
                return;
            }
            //console.log("suggest_new", val);
            this.input
                .data("data.suggest", val)
                .trigger("fb-select-new", val);
            this.trackEvent(this.name, "fb-select-new", "index", "new");
            this.hide_all();
        },

        more: function(start) {
            if (start) {
                var orig = this.input.data("original.suggest");
                if (orig !== null) {
                    this.input.val(orig);
                }
                this.request($.trim(this.input.val()), start);
                this.trackEvent(this.name, "more", "start", start);
            }
            return false;
        },

        flyout_request: function(data) {
            var self = this;
            if (this.flyout_xhr) {
                this.flyout_xhr.abort();
                this.flyout_xhr = null;
            }

            var o = this.options,
                sug_data = this.flyoutpane.data("data.suggest");
            if (sug_data && data.id === sug_data.id) {
                if (!this.flyoutpane.is(":visible")) {
                    var s = this.get_selected();
                    this.flyout_position(s);
                    this.flyoutpane.show();
                }
                return;
            }

            // check $.suggest.flyout.cache
            var cached = $.suggest.flyout.cache[data.id];
            if (cached) {
                this.flyout_response(cached);
                return;
            }

            //this.flyoutpane.hide();

            var submit_data = {
                id: data.id
            };
            if (o.as_of_time) {
                submit_data.as_of_time = o.as_of_time;
            }

            //var self = this;
            window.clearTimeout(this.flyout_request.timeout);
            this.flyout_request.timeout =
                window.setTimeout(function() {
                                      self.flyout_xhr = $.ajax({
                                                                   "type": "GET",
                                                                   "url": o.flyout_service_url + o.flyout_service_path,
                                                                   "data": submit_data,
                                                                   "success": function(data, status) {
                                                                       data = self.jsonp ? data : {id: submit_data.id, html: data};
                                                                       $.suggest.flyout.cache[data.id] = data;
                                                                       self.flyout_response(data);
                                                                   },
                                                                   "error": function(xhr, s, ex) {
                                                                       self.trackEvent(self.name, "flyout", "error", {url:this.url, response:xhr.responseText});
                                                                   },
                                                                   "dataType": self.jsonp ? "jsonp" : "html",
                                                                   "cache": true
                                                               });
                                  }, 200);
        },

        flyout_response: function(data) {
            var o = this.options,
                p = this.pane,
                s = this.get_selected() || [];
            if (p.is(":visible") && s.length) {
                var sug_data = s.data("data.suggest");
                if (sug_data && data.id === sug_data.id) {
                    this.flyoutpane.html(data.html);
                    this.flyout_position(s);
                    this.flyoutpane.show()
                        .data("data.suggest", sug_data);
                }
            }
        },

        flyout_position: function($item) {
            var p = this.pane,
                fp = this.flyoutpane,
                css = this.options.css,
                pos = undefined,
                old_pos = {
                    top: parseInt(fp.css("top"), 10),
                    left: parseInt(fp.css("left"), 10)
                },
                pane_pos = p.offset(),
                pane_width = p.outerWidth(),
                flyout_height = fp.outerHeight(),
                flyout_width = fp.outerWidth();

            if (this.options.flyout === "bottom") {
                // flyout position on top/bottom
                pos = pane_pos;
                var input_pos = this.input.offset();
                if (pane_pos.top < input_pos.top) {
                    pos.top -= flyout_height;
                }
                else {
                    pos.top += p.outerHeight();
                }
                fp.addClass(css.flyoutpane + "-bottom");
            }
            else {
                pos = $item.offset();
                var item_height = $item.outerHeight();

                pos.left += pane_width;
                var flyout_right = pos.left + flyout_width,
                    scroll_left =  $(document.body).scrollLeft(),
                    window_right = $(window).width() + scroll_left;

                pos.top = pos.top + item_height - flyout_height;
                if (pos.top < pane_pos.top) {
                    pos.top = pane_pos.top;
                }

                if (flyout_right > window_right) {
                    var left = pos.left - (pane_width + flyout_width);
                    if (left > scroll_left) {
                        pos.left = left;
                    }
                }
                fp.removeClass(css.flyoutpane + "-bottom");
            }

            if (!(pos.top === old_pos.top && pos.left === old_pos.left)) {
                fp.css({top:pos.top, left:pos.left});
            }
        },

        hoverover_list: function(e) {

        },

        hoverout_list: function(e) {
            if (this.flyoutpane && !this.get_selected()) {
                this.flyoutpane.hide();
            }
        }
    });

// Freebase suggest settings
$.extend($.suggest.suggest, {

             defaults: {

                 type: null,

                 type_strict: "any",

                 mql_filter: null,

                 as_of_time: null,

                 // base url for autocomplete service
                 service_url: "http://www.freebase.com",

                 // service_url + service_path = url to autocomplete service
                 service_path: "/private/suggest",

                 // 'left', 'right' or null
                 // where list will be aligned left or right with the input
                 align: null,

                 // whether or not to show flyout on mouseover
                 flyout: true,

                 // default is service_url if NULL
                 flyout_service_url: null,

                 // flyout_service_url + flyout_service_path = url to flyout service
                 flyout_service_path: "/private/flyout",

                 // any html snippet you want to show for the suggest new option
                 // clicking will trigger an fb-select-new event along with the input value
                 suggest_new: null,

                 nomatch: '<em class="fbs-nomatch-text">No suggested matches.</em><h3>Tips on getting better suggestions:</h3><ul class="fbs-search-tips"><li>Enter more or fewer characters</li><li>Add words related to your original search</li><li>Try alternate spellings</li><li>Check your spelling</li></ul>',

                 // CSS default class names
                 css: {
                     item_type: "fbs-item-type",
                     flyoutpane: "fbs-flyout-pane"       // outer pane of flyout          <div>
                 }
             }
         });

function init_JSON() {
    if(!this.JSON){JSON={}}(function(){function f(n){return n<10?"0"+n:n}if(typeof Date.prototype.toJSON!=="function"){Date.prototype.toJSON=function(key){return this.getUTCFullYear()+"-"+f(this.getUTCMonth()+1)+"-"+f(this.getUTCDate())+"T"+f(this.getUTCHours())+":"+f(this.getUTCMinutes())+":"+f(this.getUTCSeconds())+"Z"};String.prototype.toJSON=Number.prototype.toJSON=Boolean.prototype.toJSON=function(key){return this.valueOf()}}var cx=/[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,escapable=/[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,gap,indent,meta={"\b":"\\b","\t":"\\t","\n":"\\n","\f":"\\f","\r":"\\r",'"':'\\"',"\\":"\\\\"},rep;function quote(string){escapable.lastIndex=0;return escapable.test(string)?'"'+string.replace(escapable,function(a){var c=meta[a];return typeof c==="string"?c:"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})+'"':'"'+string+'"'}function str(key,holder){var i,k,v,length,mind=gap,partial,value=holder[key];if(value&&typeof value==="object"&&typeof value.toJSON==="function"){value=value.toJSON(key)}if(typeof rep==="function"){value=rep.call(holder,key,value)}switch(typeof value){case"string":return quote(value);case"number":return isFinite(value)?String(value):"null";case"boolean":case"null":return String(value);case"object":if(!value){return"null"}gap+=indent;partial=[];if(Object.prototype.toString.apply(value)==="[object Array]"){length=value.length;for(i=0;i<length;i+=1){partial[i]=str(i,value)||"null"}v=partial.length===0?"[]":gap?"[\n"+gap+partial.join(",\n"+gap)+"\n"+mind+"]":"["+partial.join(",")+"]";gap=mind;return v}if(rep&&typeof rep==="object"){length=rep.length;for(i=0;i<length;i+=1){k=rep[i];if(typeof k==="string"){v=str(k,value);if(v){partial.push(quote(k)+(gap?": ":":")+v)}}}}else{for(k in value){if(Object.hasOwnProperty.call(value,k)){v=str(k,value);if(v){partial.push(quote(k)+(gap?": ":":")+v)}}}}v=partial.length===0?"{}":gap?"{\n"+gap+partial.join(",\n"+gap)+"\n"+mind+"}":"{"+partial.join(",")+"}";gap=mind;return v}}if(typeof JSON.stringify!=="function"){JSON.stringify=function(value,replacer,space){var i;gap="";indent="";if(typeof space==="number"){for(i=0;i<space;i+=1){indent+=" "}}else{if(typeof space==="string"){indent=space}}rep=replacer;if(replacer&&typeof replacer!=="function"&&(typeof replacer!=="object"||typeof replacer.length!=="number")){throw new Error("JSON.stringify")}return str("",{"":value})}}if(typeof JSON.parse!=="function"){JSON.parse=function(text,reviver){var j;function walk(holder,key){var k,v,value=holder[key];if(value&&typeof value==="object"){for(k in value){if(Object.hasOwnProperty.call(value,k)){v=walk(value,k);if(v!==undefined){value[k]=v}else{delete value[k]}}}}return reviver.call(holder,key,value)}cx.lastIndex=0;if(cx.test(text)){text=text.replace(cx,function(a){return"\\u"+("0000"+a.charCodeAt(0).toString(16)).slice(-4)})}if(/^[\],:{}\s]*$/.test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g,"@").replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g,"]").replace(/(?:^|:|,)(?:\s*\[)+/g,""))){j=eval("("+text+")");return typeof reviver==="function"?walk({"":j},""):j}throw new SyntaxError("JSON.parse")}}}());
}
})(jQuery);


jQuery.suggest.version='Version:r79501 Built:Fri Aug 14 2009 by daepark';
