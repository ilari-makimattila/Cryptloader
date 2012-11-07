
function Cryptloader()
{

}

Cryptloader.prototype = {
    initialize: function (domElement)
    {
        var self = this
        this.element = domElement
        domElement.addEventListener("dragenter", function (e) { return self.dragenter(e) }, false)
        domElement.addEventListener("dragover", function (e) { return self.dragover(e) }, false)
        domElement.addEventListener("drop", function (e) { return self.drop(e) }, false)
    },

    dragenter: function (event)
    {
        event.stopPropagation()
        event.preventDefault()
    },

    dragover: function (event)
    {
        event.stopPropagation()
        event.preventDefault()
    },

    drop: function (event)
    {
        event.stopPropagation()
        event.preventDefault()

        console.log("Got a file drop!")

        var dt = event.dataTransfer
        var files = dt.files

        this.handleFiles(files)
    },

    handleFiles: function (files)
    {
        var self = this
        for (var i = 0; i < files.length; i++)
        {
            var file = files[i]

            var reader = new FileReader()
            reader.onload = function(e) { self.fileLoad(e) }
            reader.onprogress = function(e) { self.fileProgress(e) }
            reader.readAsDataURL(file)
        }
    },

    fileLoad: function (event)
    {
        console.log("received a file!")
    },

    fileProgress: function (event)
    {
        console.log("progress!")
        console.log(event)
    }
}