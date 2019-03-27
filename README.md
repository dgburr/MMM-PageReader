# MMM-PageReader

## Overview
`MMM-PageReader` is a MagicMirror² Module for reading web content.  It loads a specified URL, highlights each sentence in turn and then closes.  

`MMM-PageReader` can be used for two different use cases:

1. Automatic (timed) scrolling
2. Event-driven scrolling (useful for interacting with a Text-to-Speech engine)

## Configuration
Default configuration:

```javascript
{
    module: "MMM-PageReader",
    config: {
        highlight: 'background-color:red;', // CSS to be applied to highlighted sentences
        width: "100%",  // width of page reading window (px or %)
        height: "100%", // height of page reading window (px or %)
        left: "0",      // X position of page reading window (px)
        top: "0",       // Y position of page reading window (px)
        timeout: 1000,  // amount of time (in ms) to wait before moving to the next sentence.  If set to 0, waits for a PAGE_READER_NEXT event
        notification: null, // if defined, a notification with this name (and payload containing text) will be sent for each sentence
    },
}
```

### Automatic (timed) scrolling

```javascript
{
    module: "MMM-PageReader",
    config: {
        timeout: 1000,
        notification: null,
    }
}
```

### Event-driven scrolling

```javascript
{
    module: "MMM-PageReader",
    config: {
        highlight: 'background-color:yellow',
        timeout: 0,
        notification: "PAGE_READER_SENTENCE",
    }
}
```

## Notifications
`MMM-PageReader` listens for the following notifications:

* `PAGE_READER_LOAD`: payload specifies a URL to load and display
* `PAGE_READER_NEXT`: highlight the next sentence (or close the window if the last sentence is currently being displayed)
* `PAGE_READER_STOP`: close the window if currently displayed
* `PAGE_READER_PAUSE`: pause reading
* `PAGE_READER_RESUME`: resume reading

If the `notification` option is set in the configuration, then `MMM-PageReader` will send a notification of this type for each sentence, with the payload corresponding to the sentence text.
