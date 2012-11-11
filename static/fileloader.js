// Fileloader encapsulates the drag&drop logic.
// You need just to overwrite the handleFiles method
// or fileLoad method if you want to handle files one by one
function Fileloader()
{

}

Fileloader.prototype = {
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
        for (var i = 0; i < files.length; i++)
        {
            var file = files[i]

            this.fileLoad(file)
        }
    },

    fileLoad: function (file)
    {
        console.log("received a file!")
    }
}