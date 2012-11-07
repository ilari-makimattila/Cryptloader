var FILE_SLICE_SIZE = 10240
var file_queue = {}

Int32Array.prototype.toJSONArray = function()
{
    var a = "["
    for (var i = 0; i < this.length; i++)
    {
        a += this[i]
        if (i + 1 < this.length)
            a += ","
    }
    return a + "]"
}

var file_handlers =
{
    "error": function (ws, data)
    {
        alert("Server error: " + d["data"])
    },

    "readyfortransfer": function (ws, data)
    {
        var slice = data["slice"]
        var start = slice * FILE_SLICE_SIZE
        var end = Math.min((slice + 1) * FILE_SLICE_SIZE, file_queue[data["id"]].size - 1)

        console.log("Transferring slice " + slice + " of file " + data["id"] + ", reading bytes " + start + " to " + end)

        var part = file_queue[data["id"]].slice(start, end)

        var reader = new FileReader()
        reader.onload = function(e)
        {
            var passwd = document.getElementById("password").value

            console.log("Uploading arraybuffer of size " + e.target.result.byteLength)
            var i32a = new Int32Array(e.target.result)

            var out = i32a.toJSONArray()

            console.log("crypting: " + out)

            var crypted = sjcl.encrypt(passwd, out)
            //var crypted = e.target.result

            ws.send(JSON.stringify({
                "type": "fileslice",
                "data": {"id": data["id"], "slice": slice, "data": crypted}
            }))
        }
        reader.readAsArrayBuffer(part)
    },

    "transfercompleted": function (ws, data)
    {
        delete file_queue[data["id"]]

        var a = document.createElement("a")
        var url =  "http://localhost:8888/get/" +
                data["filename"] +
                "#" +
                document.getElementById("password").value

        a.href = url
        a.innerHTML = url

        var li = document.createElement("li")
        li.appendChild(a)

        document.getElementById("fileurllist").appendChild(li)
    }
}

document.addEventListener("DOMContentLoaded", function ()
{
    // generate a random password
    var passwd = ""
    for (var i = 0; i < 20; i++)
    {
        passwd += String.fromCharCode(Math.floor(Math.random() *  93 + 33))
    }
    document.getElementById("password").value = passwd


    var ws = new WebSocket("ws://localhost:8888", "data-upload")

    ws.addEventListener("open", function(event)
    {
        console.log("Websocket connected")
    })

    // Display messages received from the server
    ws.addEventListener("message", function(event)
    {
        try
        {
            var d = JSON.parse(event.data)

            if (typeof file_handlers[d["type"]] === "function")
            {
                file_handlers[d["type"]](ws, d["data"])
            }
            else
            {
                console.log("Unknown message: " + event.data)
            }
        }
        catch (e)
        {
            alert("Unknown error: " + e)
        }
    })

    // Display any errors that occur
    ws.addEventListener("error", function(event)
    {
        console.log("Websocket error!")
        console.log(event)
    })

    ws.addEventListener("close", function(event) {
        console.log("Websocket closed")
    })

    var c = new Cryptloader()

    c.handleFiles = function (files)
    {
        for (var i in files)
        {
            var file = files[i]

            console.log("Got a file " + file.type + " named " + file.name)

            var slices = Math.ceil(file.size / FILE_SLICE_SIZE)
            var id = (new Date()).toJSON() + "-" + Math.random()

            if (slices > 0)
            {
                file_queue[id] = file
                console.log("Beginning upload of " + file.size + " bytes in " + slices + " parts")
                ws.send(JSON.stringify({"type": "incomingfile", "data": { "slices": slices, "id": id}}))
            }
        }
    }

    c.initialize(document.getElementById("droparea"))
})
