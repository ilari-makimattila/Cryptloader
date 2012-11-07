var file_contents = {}

var get_handlers =
{
    "error": function (ws, data)
    {
        alert("Server error: " + data)
    },

    "incomingfile": function (ws, data)
    {
        var slices = data["slices"]
        var file = data["id"]
        console.log("Receiving a file in " + slices + " parts")

        file_contents[file] =
        {
            "slices": slices,
            "currentslice": 0,
            "data": []
        }

        ws.send(JSON.stringify({"type": "getslice", "data": {"id": file, "slice": 0}}))
    },

    "fileslice": function (ws, data)
    {
        var file = data["id"]
        var slice = data["slice"]

        console.log("Receiving part " + slice + " of file " + file)

        if (slice === file_contents[file]["currentslice"])
        {
            // get passwd from url
            var parser = document.createElement("a")
            parser.href = window.location.href

            var passwd = parser.hash.substring(1)
            console.log("Decrypting using password " + passwd)
            var decrypted = sjcl.decrypt(passwd, data["data"])
            //var decrypted = data["data"]

            console.log(JSON.parse(decrypted))

            file_contents[file]["data"].push(new Int32Array(JSON.parse(decrypted)))

            file_contents[file]["currentslice"]++

            if (slice < file_contents[file]["slices"] - 1)
            {
                ws.send(JSON.stringify({
                    "type": "getslice",
                    "data": {
                        "id": file,
                        "slice": slice + 1
                    }
                }))
            }
            else
            {
                console.log("File transfer complete!")

                console.log(file_contents[file]["data"])
                var blob = new Blob(file_contents[file]["data"])
                delete file_contents[file]

                console.log("Created a blob of size " + blob.size)

                var reader = new FileReader()
                reader.onload = function (e)
                {
                    console.log("I have read my blob")
                    document.getElementById("file").href = e.target.result

                    document.getElementById("waiter").style.display = "none"
                    document.getElementById("fileready").style.display = "block"
                }
                reader.readAsDataURL(blob)



            }
        }
        else
        {
            console.log("File order mismatch!")
        }
    }
}

document.addEventListener("DOMContentLoaded", function ()
{
    var ws = new WebSocket("ws://localhost:8888", "data-upload")

    ws.addEventListener("open", function(event)
    {
        console.log("Websocket connected")

        // get filename from url
        var parser = document.createElement("a")
        parser.href = window.location.href

        var filename = parser.pathname.substring(5) // "/get/".length

        console.log("Requesting...")

        ws.send(JSON.stringify({"type": "get", "data": filename}))
        console.log("Sent request for file " + filename)
    })

    // Display messages received from the server
    ws.addEventListener("message", function(event)
    {
        console.log("Receiving from server")
        try
        {
            var d = JSON.parse(event.data)

            if (typeof get_handlers[d["type"]] === "function")
            {
                get_handlers[d["type"]](ws, d["data"])
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
        console.log("Websocket error: " + event)
    })

    ws.addEventListener("close", function(event)
    {
        console.log("Websocket closed")
    })
})
