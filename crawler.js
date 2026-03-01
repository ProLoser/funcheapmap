async function pageFunction(context) {
    const { $, request, log } = context;

    const API_KEY = 'GOOGLE_TOKEN';
    const pageTitle = $('title').first().text();
    const MAP_IFRAME = 'https://www.google.com/maps/embed/v1/place?q=';
    const mapIframe = $(`iframe[src^="${MAP_IFRAME}"]`);
    // const mapIframe = $('iframe[src]').filter((el) => el.src.startsWith(MAP_IFRAME));
    const geocode = address => fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}`)

    if (mapIframe.length) {

        // const location = $('b:contains("Address")').first().next().text();
        const location = (new URL(mapIframe.attr('src'))).searchParams.get('q');
        let geometry;
        try {
            // context.log.info(`Geocoding... ${JSON.stringify(location)}`)
            // results = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(location)}&key=${API_KEY}`)
            results = await geocode(location)
            if (results.ok) {
                json = await results.json();
                // context.log.info(`Resolved Geocode`, json.results[0]?.geometry.location)
                geometry = json.results[0]?.geometry.location;

                // If no geometry found, retry with ", san francisco" appended
                if (!geometry) {
                    context.log.info('No geometry found, retrying with ", san francisco" appended');
                    const locationWithSF = location + ', san francisco';
                    // results = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(locationWithSF)}&key=${API_KEY}`)
                    results = await geocode(locationWithSF)
                    if (results.ok) {
                        json = await results.json();
                        geometry = json.results[0]?.geometry.location;
                    }
                    if (!geometry) {
                        context.log.error('geometry missing after retry', { results, json })
                    }
                }
            } else {
                context.log.error('cannot geocode', { results })
            }
        } catch (error) {
            context.log.error('cannot geocode', { error })
        }
        // Would love to use span.cost but it's occasionally missing...
        const date = $('#stats .left a:first').text()
        const time = $('#stats .left span:first').contents().first().text().substr(2).trim()
        const cost = $('span.cost:last').contents().last().text().trim()
        // const cost_details = $('span.cost:first').next().find('.middle').text().trim()
        const cost_details = $('.cost_details').text();
        const venue = $('#stats .left br:first').next().text()
        const eventUrl = $('a[name*="Learn More"], a[name*="Event Details"], a[name*="RSVP"], a[name*="Buy Tickets"]').attr('href')
        const categories = $('.entry [rel="category tag"]').toArray().map(el => $(el).text())


        // Swap async images with noscript images
        $('img[data-spai]').each((i, el) => {
            const $el = $(el)
            const $noscript = $el.next()
            $el.replaceWith($noscript.html())
            $noscript.remove()
        })
        // Fix instagram embeds
        $('.instagram-media').each((i, el) => {
            const $el = $(el)
            let src = $el.attr('data-instgrm-permalink')
            src = new URL(src)
            src.pathname += 'embed/captioned'
            $el.replaceWith(`<iframe src="${src.toString()}" />`)
        })
        // Remove ads
        $('section, style').remove()

        let details = $('.at-above-post')
            .nextUntil('.at-below-post')
            .map((i, el) => $.html(el))
            .get().join("\n")

        // Prepend wp-post-image if found
        try {
            const postImage = $('img.wp-post-image');
            if (postImage.length && !$('.at-above-post:first-of-type ~ .media-credit-container').length) {
                context.log.info('Prepending wp-post-image to details');
                details = `${$.html(postImage)}\n${details || ''}`;
            }
        } catch (error) {
            context.log.error('Error prepending wp-post-image to details', { error });
        }

        // Print some information to actor log
        context.log.info(`URL: ${context.request.url}, TITLE: ${pageTitle}`);

        // Manually add a new page to the queue for scraping.
        //    await context.enqueueRequest({ url: 'http://www.example.com' });

        // Return an object with the data extracted from the page.
        // It will be stored to the resulting dataset.
        return {
            url: context.request.url,
            eventUrl,
            title: pageTitle,
            location,
            geometry,
            date,
            date_text: date,
            categories: categories,
            details,
            date_text: date,
            venue,
            time,
            cost,
            cost_details,
        };
    } else {
        context.log.info(`SKIPPING URL: ${context.request.url}, TITLE: ${pageTitle}`);
        return null;
    }
}