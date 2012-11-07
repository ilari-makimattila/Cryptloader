// Cryptloader - encrypt your files in browser before uploading them
// Copyright (C) 2012 Ilari Mäkimattila

// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>.

var http = require("http")
var WebSocketServer = require("websocket").server;
var url = require("url")
var querystring = require("querystring")
var fs = require("fs")
var crypto = require("crypto")
var exec = require("child_process").exec

function content_not_found(response)
{
    response.writeHead(404, {"Content-Type": "text/html"})
    response.write("404 Not found")
    response.end()
}

// Routes the request to a handle selected by regexp match
function route(handle, pathname, request, response)
{
    for (var key in handle)
    {
        if ((new RegExp(key)).test(pathname))
        {
            handle[key](request, response)
            return
        }
    }

    content_not_found(response)
}

var handle = {}

// Handler for the index page
handle["^/(index(\.html)?)?$"] = function (request, response)
{
    console.log("Request handler 'index' was called.")

    fs.readFile("./views/index.html", "utf8", function (err, data)
    {
        if (err)
        {
            content_not_found(response)
            return
        }

        response.writeHead(200, {"Content-Type": "text/html"})
        response.write(data)
        response.end()
    })
}

// Handler for file download page
handle["^/get/.+$"] = function (request, response)
{
    fs.readFile("./views/get.html", "utf8", function (err, data)
    {
        if (err) {
            content_not_found(response)
            return
        }

        response.writeHead(200, {"Content-Type": "text/html"})
        response.write(data)
        response.end()
    })
}

// Handler for static content
handle["^/static/[a-z].*$"] = function (request, response)
{
    console.log(request.url)
    var filename = url.parse(request.url).pathname.substring(8) // "/static/".length

    fs.readFile("./static/" + filename, "utf8", function (err, data)
    {
        if (err)
        {
            content_not_found(response)
            return
        }

        // TODO: obviously a hack but it'll have to do for now
        var suffix = filename.substring(filename.lastIndexOf('.') + 1)
        var mime
        switch (suffix)
        {
            case "js":
                mime = "text/javascript"
                break
            case "css":
                mime = "text/css"
                break
            default:
                mime = "application/octet-stream"
        }

        response.writeHead(200, {"Content-Type": mime})
        response.write(data)
        response.end()
    })
}

var file_queue = {}

// Handlers for websocket requests
var wshandlers =
{
    // Handles a file transfer start
    "incomingfile": function (connection, data)
    {
        console.log("Incoming file id " + data["id"] + " in " + data["slices"] + " parts")

        var sha1sum = crypto.createHash("sha1")
        sha1sum.update((new Date()).toJSON())
        sha1sum.update(connection.remoteAddress)

        var filename = sha1sum.digest("hex")

        file_queue[data["id"]] = {
            "filename": filename,
            "slices": data["slices"],
            "currentslice": 0
        }

        connection.sendUTF(JSON.stringify({
            "type": "readyfortransfer",
            "data": {"slice": 0, "id": data["id"] }
        }))
    },

    // Receives a part of a file and writes it to disk
    "fileslice": function (connection, data)
    {
        var f = file_queue[data["id"]]
        var slice = data["slice"]

        console.log("Incoming part " + slice + " of file " + data["id"])

        if (f["currentslice"] === slice)
        {
            fs.writeFile("./files/" + f["filename"] + "-" + slice, data["data"], function (err)
            {
                if (err)
                {
                    console.log("File write error!")
                    return
                }

                file_queue[data["id"]]["currentslice"]++

                if (file_queue[data["id"]]["slices"] - 1 === slice)
                {
                    console.log("File id " + data["id"] + " received!")
                    connection.sendUTF(JSON.stringify({
                        "type": "transfercompleted",
                        "data": {"filename": file_queue[data["id"]]["filename"],
                            "id": data["id"]
                        }
                    }))

                    delete file_queue[data["id"]]
                }
                else
                {
                    connection.sendUTF(JSON.stringify({
                        "type": "readyfortransfer",
                        "data": {"slice": file_queue[data["id"]]["currentslice"],
                            "id": data["id"]
                        }
                    }))
                }
            })
        }
        else
        {
            console.log("File order error!")
        }
    },

    // Initializes a file upload to client
    "get": function (connection, data)
    {
        console.log("Requested a file " + data)

        fs.readdir("./files/", function (err, files)
        {
            if (err)
            {
                connection.sendUTF(JSON.stringify({"type": "error", "data": err}))
            }
            else
            {
                var slices = 0
                for (var i in files)
                {
                    if (files[i].indexOf(data) === 0)
                        slices++
                }
                if (slices > 0)
                {
                    connection.sendUTF(JSON.stringify({
                        "type": "incomingfile",
                        "data":{"id": data, "slices": slices}}))
                }
                else
                {
                    connection.sendUTF(JSON.stringify({
                        "type": "error",
                        "data": "File " + data + " not found!"}))
                }
            }
        })
    },

    // Sends a requested file part to client
    "getslice": function (connection, data)
    {
        var file = data["id"]
        var slice = data["slice"]

        console.log("Requested slice " + slice + " of file " + file)

        fs.readFile("./files/" + file + "-" + slice, "utf8", function (err, fdata)
        {
            if (err)
            {
                console.log("Error reading file " + file + "-" + slice)
                console.log(err)
            }
            else
            {
                console.log("Sending slice " + slice + " of file " + file)
                connection.sendUTF(JSON.stringify({
                    "type": "fileslice",
                    "data": {
                        "id": file,
                        "slice": slice,
                        "data": fdata
                    }
                }))
            }
        })
    }
}

// Start up the http server
var httpServer = http.createServer(function (request, response)
{
    var pathname = url.parse(request.url).pathname
    console.log("routing " + pathname)
    route(handle, pathname, request, response)
}).listen(8888)

// Start up the websocket server
wsServer = new WebSocketServer(
{
    httpServer: httpServer,
    autoAcceptConnections: false
})

function originIsAllowed(origin)
{
  console.log("websocket request from origin " + origin)
  return true
}

wsServer.on("request", function(request)
{
    if (!originIsAllowed(request.origin))
    {
      // Make sure we only accept requests from an allowed origin
      request.reject()
      console.log((new Date()) + " Connection from origin " + request.origin + " rejected.")
      return;
    }

    var connection = request.accept("data-upload", request.origin)

    console.log((new Date()) + " Connection accepted.")

    connection.on("message", function(message)
    {
        if (message.type === "utf8")
        {
            var data
            try
            {
                data = JSON.parse(message.utf8Data)
            }
            catch (e)
            {
                console.log("Received invalid data: " + message.utf8Data)
                connection.sendUTF(JSON.stringify({"type": "error", "data": e}))
                return
            }

            if (typeof wshandlers[data["type"]] === "function")
            {
                wshandlers[data["type"]](connection, data["data"])
            }
            else
            {
                console.log("Unhandled request type " + data["type"])
            }
        }
        else if (message.type === "binary")
        {
            console.log("Received Binary Message of " + message.binaryData.length + " bytes")
            connection.sendBytes(message.binaryData)
        }
    });
    connection.on("close", function(reasonCode, description)
    {
        console.log((new Date()) + " Peer " + connection.remoteAddress + " disconnected.")
    })
})

