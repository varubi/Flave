const Tokens = require('./tokens.js')
const Dictionary = require('./dictionary.js')
const Sections = require('./sections.js')

function Transpile(input, config) {
    this.config = ProxyLayer({
        quote: '\'',
        stripcomments: true,
        output: '$O',
        trim: true,
        newlines: true,
        export: true
    })
    config = config || {};
    for (var key in config)
        this.config[key] = config[key];

    this.transpiled = '';
    this.classlist = [];
    this.classname = '';
    this.lastWrite = '\n';
    this.indent = '';
    this.tokens = new Tokens(input);
    this.views = [];
    this.nestLevel = [];
    this.index;

    Sections.Source(this);

}

Transpile.prototype.testName = function (name) {
    return (new RegExp('^[a-zA-z_$][a-zA-z_$\\d]+$')).test(name) && Dictionary.ReservedKeywords.indexOf(name) === -1;
}
Transpile.prototype.nest = function () {
    if (this.tokens.current().Info.GroupEdge == 'OPEN')
        this.nestLevel.push(this.tokens.current())
    else if (this.nestLevel.length) {
        var last = this.nestLevel.pop();
        if (last.Info.SubType != this.tokens.current().Info.SubType) {
            throw this.error('Expected ' + Dictionary.ByName[last.Info.Name.replace(/L$/, 'R')].Symbol + ' instead of ' + this.tokens.current().Value)
        }
    } else {
        throw this.error('Did not expect ' + this.tokens.current().Value)

    }
}
Transpile.prototype.error = function (message) {
    return message.replace(/\n/, 'New Line') + ' at Line ' + this.tokens.line;
}
Transpile.prototype.getString = function (ary) {
    if (typeof ary == 'undefined')
        var a = 1;
    var str = '';
    if (typeof ary == 'string')
        str = ary;
    else if (ary.length && typeof ary[0] == 'string')
        str = ary.join('\n')
    else if (ary.length && ary[0].hasOwnProperty('Value'))
        for (var i = 0; i < ary.length; i++) {
            str += ary[i].Value;
        }
    if (typeof ary == 'undefined')
        var a = 1;
    return str.split('\n');
}
Transpile.prototype.writeSegment = function (string) {
    var write = string;
    if (this.lastWrite.slice(-1) == '\n' && write.substr(0, 1) == '\n')
        write = write.substr(1);
    else if (this.lastWrite.trim() == '' && write.indexOf(this.lastWrite) === 0)
        write = write.substr(this.lastWrite.length)
    if (write == '')
        return;
    this.lastWrite = string;
    this.transpiled += write;
}
Transpile.prototype.writeNewLine = function (indent) {
    if (!this.config.newlines)
        return;
    var nl = '\n' + (indent ? this.indent : '');
    this.writeSegment(nl)
}
Transpile.prototype.writeViewJoin = function (inline) {
    if (!this.config.newlines) {
        this.writeSegment('+');
        return;
    }
    this.writeSegment((inline ? ' ' : '\t') + '+ ');
};
Transpile.prototype.writeLiteral = function (lines, inline) {
    lines = this.getString(lines);
    for (var i = 0; i < lines.length; i++) {
        if (lines[i].trim() == '')
            continue;
        if (!inline)
            this.writeNewLine(true)
        this.writeSegment(inline || !this.config.trim ? lines[i] : lines[i].trimLeft())
        if (i != lines.length - 1)
            this.writeNewLine()
        inline = false;
    }

};
Transpile.prototype.writeView = function (string) {
    string = this.getString(string);
    if (string.length > 1)
        throw 'some err';
    this.writeSegment(string[0].replace('\\', '\\\\').replace(new RegExp(this.config.quote, 'g'), '\\' + this.config.quote));

}
Transpile.prototype.indent_add = function () {
    this.indent += '\t';
}
Transpile.prototype.indent_sub = function () {
    this.indent = this.indent.slice(0, -1)
}

function ProxyLayer(obj, layers) {
    obj = obj || {};
    layers = Array.isArray(layers) ? layers.slice() : [];
    layers.unshift(obj);
    var override = new Proxy(layers, {
        get: (target, key) => layers.map((layer) => layer[key]),
        set: function (target, key, value) {
            for (var i = 0; i < layers.length; i++)
                layers[i][key] = value;
        }
    })

    return new Proxy(layers, {
        get: function (target, key) {
            switch (key) {
                case 'layer':
                    return (obj) => (layers.unshift(obj || {}) && true)

                case 'unlayer':
                    return () => (layers.shift() && true)

                case 'relayer':
                    return () => (layers[0] = {} && true)

                case 'clone':
                    return (obj) => ProxyLayer(obj, layers)

                case 'override':
                    return override;

                case 'global':
                    return layers[layers.length - 1];

                default:
                    for (var i = 0; i < layers.length; i++)
                        if (layers[i].hasOwnProperty(key))
                            return layers[i][key];
            }
        },
        set: (target, key, value) => { target[0][key] = value; }
    })
}

module.exports.transpile = function (input, config) {
    return new Transpile(input, config).transpiled;
};
