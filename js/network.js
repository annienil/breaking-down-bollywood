
class Network {
    constructor(_config, _dataCollab, _dataCrew, _dataFull){
        this.config = {
            parentElement: _config.parentElement,
            containerWidth: _config.containerWidth || 500,
            containerHeight: _config.containerHeight || 500,
            networkWidth: _config.networkWidth,
            networkHeight: _config.networkHeight,
            radius: 230,
            margin: _config.margin || {
                top: 20,
                right: 40,
                bottom: 25,
                left: 40
            },
            tooltipPadding: _config.tooltipPadding || 15
        }
        this.dataCollab = _dataCollab;
        this.dataCrew = _dataCrew;
        this.dataFull = _dataFull;
        this.formatCollabs();
        // this.formatData();
        this.initVis();

    }

    formatCollabs() {
        let vis = this;

        vis.actorNames = [];
        vis.actors = [];
        vis.genreAnnotations = [];
        vis.actorNamesIndex = [];

        vis.makeIntialActorNames();

        vis.findGenres();

        vis.actors.sort(function(a, b){
            let x = a.mostFrequent;
            let y = b.mostFrequent;
            if (x < y) {return -1;}
            if (x > y) {return 1;}
            return 0;
          });

        vis.makeNameAnnotation();

    }

    makeIntialActorNames() {
        let vis = this;

        vis.dataCollab.forEach(d => {
            if (!vis.actorNames.includes(d.actor)) {
                // actor not already included in list
                vis.actorNames.push(d.actor);
                vis.actors.push({name: d.actor});
            }

            if (!vis.actorNames.includes(d.collab)) {
                // actor not already included in list
                vis.actorNames.push(d.collab);
                vis.actors.push({name: d.collab});
            }
        });
    }

    findGenres() {
        let vis = this;

        vis.dataCollab.forEach(d => {
            // for actor
            let indexActor = vis.actorNames.indexOf(d.actor);
            let actor = vis.actors[indexActor];

            let indexCollab = vis.actorNames.indexOf(d.collab);
            let collab = vis.actors[indexCollab];
            actor.genres = [];
            collab.genres = [];

            d.genres.forEach(g => {
                actor.genres.push(g);
                collab.genres.push(g);
            });
        });

        // find the most common genres for each actor
        vis.actors.forEach(d => {
            // find most common genre
            let genre = [];
            let frequency = [];

            let bigGenre = "";
            let bigFrequency = 0;

            d.genres.forEach(g => {
                if (genre.includes(g)) {
                    frequency[genre.indexOf(g)]++;
                    if (frequency[genre.indexOf(g)] == bigFrequency) {
                        bigGenre = g + "|" + bigGenre;
                    } else if (frequency[genre.indexOf(g)] > bigFrequency) {
                        bigGenre = g;
                    }
                } else {
                    genre.push(g);
                    frequency.push(1);
                }
            });
            d.mostFrequent = bigGenre;
        });
    }

    makeNameAnnotation() {
        // make the data list required for the annotation paths and labels
        let vis = this;

        let previous = "";
        let genreStart = "";
        let genreLength = 1;

        vis.actors.forEach(d => {
            if (d.mostFrequent !== previous) {
                vis.actorNamesIndex.push("");
                if (previous !== "" && genreStart !== "") {
                    vis.genreAnnotations.push([previous, genreStart, genreLength]);
                }
                genreStart = d.name;
                genreLength = 0;
            }
            vis.actorNamesIndex.push(d.name);
            previous = d.mostFrequent;
            genreLength++;
        });

        // 3 things in the array: [genre, genreStart, genreLength]
        // genre is the genre, genreStart is the name of the first actor in the sequence, 
        // and genreLength is how many actors are in a genre group

        vis.genreAnnotations.push([previous, genreStart, genreLength]);

    }

    getX(index, radius) {
        // ESSENTIALLY OUR X SCALE
        let vis = this;
        let length = vis.actorNamesIndex.length;
        // calculate the x position
        return radius * Math.sin((2 * Math.PI) / length * index) + vis.config.width / 2;
    }

    getY(index, radius) {
        // ESSENTIALLY OUR Y SCALE
        let vis = this;
        let length = vis.actorNamesIndex.length;
        // calculate the y position
        return radius * Math.cos((2 * Math.PI) / length * index) + vis.config.height / 2;
    }
    initVis(){
        let vis = this;
        // Define inner chart size
        vis.config.width = vis.config.networkWidth - vis.config.margin.left - vis.config.margin.right;
        vis.config.height = vis.config.networkHeight - vis.config.margin.top - vis.config.margin.bottom;


        // // colour scale for the genres. Can be changed I went off of the vibes of the genres
        vis.genreColourScale = d3.scaleOrdinal()
            .domain(["Comedy", "Romance", "Drama", "Action", "Mystery", "Family", "Thriller", "Crime", "Musical", "Adventure", "Fantasy"])
            .range(["gold", "deeppink", "darkslategray", "darkred", "darkblue", "cornflowerblue", "midnightblue", "orangered", "thistle", "green", "darkmagenta"]);

        // scale for calculating the width of the line, dependent on collaboration count
        vis.lineWidthScale = d3.scaleLinear()
            .domain([d3.min(vis.dataCollab, d => d.count), d3.max(vis.dataCollab, d => d.count)])
            .range([0.7, 5.5]);

        // Define svg area
        vis.svg = d3.select("#network").append("svg")
            .attr('id', 'network')
            .attr('width', vis.config.networkWidth)
            .attr('height', vis.config.networkHeight)
            .on('click', function (event) {
                updateGlobalActorSelection(null)
            })
            // commenting this to move network down
            // .attr('transform', `translate(${vis.config.networkWidth}, ${-vis.config.networkHeight})`);

        // // Add chart element
        vis.chart = vis.svg.append('g')
            .attr('id', 'chart')
            .attr('transform', `translate(${vis.config.margin.left},${vis.config.margin.top})`)
            .attr('height', vis.config.height)
            .attr('width', vis.config.width);

        vis.linesGroup = vis.chart.append('g')
            .attr('id', 'lines');

        vis.circleGroup = vis.chart.append('g')
            .attr('id', 'circles');

        vis.svg
            .append("text")
            .attr("class", "axis-title")
            .attr("x", (vis.config.width / 2) + 45)
            .attr("y", 20)
            .attr("dy", ".5")
            .attr("text-anchor", "middle")
            .text("Frequent Actor Collaboration Network");

        vis.updateVis();
    }

    collabHierarchy() {
        let vis = this;

        // calculate the curve 'anchor point' for each genre category, to be used in the bezier curves
        vis.genreAnnotations.forEach(d => {
            d.push(vis.getX(vis.actorNamesIndex.indexOf(d[1]) + Math.floor(d[2]/2), vis.config.radius - (d[2] * 4)));
            d.push(vis.getY(vis.actorNamesIndex.indexOf(d[1]) + Math.floor(d[2]/2), vis.config.radius - (d[2] * 4)));
        });

        // record the actor's anchor point and the collab's anchor point for the bezier curves
        vis.dataCollab.forEach(d => {
            let actor = vis.actors.filter(a => a.name == d.actor);
            let collab = vis.actors.filter(a => a.name == d.collab);
            d.actorGenre = actor[0].mostFrequent;
            d.collabGenre = collab[0].mostFrequent;
            let actorGenre = vis.genreAnnotations.filter(g => g[0] === d.actorGenre)[0];
            let collabGenre = vis.genreAnnotations.filter(g => g[0] === d.collabGenre)[0];
            d.actorAnchorX = actorGenre[3];
            d.actorAnchorY = actorGenre[4];
            d.collabAnchorX = collabGenre[3];
            d.collabAnchorY = collabGenre[4];
        })
    }

    updateVis(){
        let vis = this;

        vis.collabHierarchy();

        vis.renderVis();
    }

     // Add an arc for each link.
   annotationPath(data) {
    let vis = this;
    const index = vis.actorNames.indexOf(data[1]) - 0.5;
    const startX = vis.getX(index, vis.config.radius + 5);
    const startY = vis.getY(index, vis.config.radius + 5);
    const arcStartX = vis.getX(index, vis.config.radius + 15);
    const arcStartY = vis.getY(index, vis.config.radius + 15);
    const arcEndX = vis.getX(index + data[2], vis.config.radius + 15);
    const arcEndY = vis.getY(index + data [2], vis.config.radius + 15);
    const endX = vis.getX(index + data[2], vis.config.radius + 5);
    const endY = vis.getY(index + data[2], vis.config.radius + 5);

    return `M ${startX} ${startY} L ${arcStartX} ${arcStartY} A ${vis.config.radius + 15} ${vis.config.radius + 15} 0 0 0 ${arcEndX} ${arcEndY} L ${endX} ${endY}`;
  }

     // Add an arc for each link.
   annotationPath(data) {
    let vis = this;
    const index = vis.actorNames.indexOf(data[1]) - 0.5;
    const startX = vis.getX(index, vis.config.radius + 5);
    const startY = vis.getY(index, vis.config.radius + 5);
    const arcStartX = vis.getX(index, vis.config.radius + 15);
    const arcStartY = vis.getY(index, vis.config.radius + 15);
    const arcEndX = vis.getX(index + data[2], vis.config.radius + 15);
    const arcEndY = vis.getY(index + data [2], vis.config.radius + 15);
    const endX = vis.getX(index + data[2], vis.config.radius + 5);
    const endY = vis.getY(index + data[2], vis.config.radius + 5);

    return `M ${startX} ${startY} L ${arcStartX} ${arcStartY} A ${vis.config.radius + 15} ${vis.config.radius + 15} 0 0 0 ${arcEndX} ${arcEndY} L ${endX} ${endY}`;
  }

    renderVis() {
        let vis = this;

        // draw lines
        vis.lines = vis.linesGroup.selectAll('.network-lines')
            .data(vis.dataCollab)
            .join('path')
            .attr('class', d => `network-lines ${d.actor} ${d.collab}`)
            .attr("d", d => vis.linePath(d))
            .attr('fill', "none")
            .attr('stroke-width', d => vis.lineWidthScale(d.count));

        // listener for line interactivity
        vis.lines
            .on('mouseover', function (event, d) {
                d3.select('#tooltip')
                .style('display', 'block')
                .style('left', event.pageX + vis.config.tooltipPadding + 'px')
                .style('top', event.pageY + vis.config.tooltipPadding + 'px')
                .html(`
                <dive class='tooltip-title'>${d.actor}</div>
                <div>Collaborator: ${d.collab}</div>
                <div>Number of collaborations: ${d.count}</div>
                `);
            })
            .on('mouseleave', function () {
                d3.select('#tooltip').style('display', 'none');
            });


        // draw points
        vis.points = vis.circleGroup.selectAll('.network-point')
            .data(vis.actors)
            .join('circle')
            .attr('class', d => `network-point ${d.name}`)
            .attr('id', d => d.name.replace(/ /g, ""))
            .attr('cx', d => vis.getX(vis.actorNamesIndex.indexOf(d.name), vis.config.radius))
            .attr('cy', d => vis.getY(vis.actorNamesIndex.indexOf(d.name), vis.config.radius))
            .attr('fill', d => vis.genreColourScale(d.mostFrequent))
            .attr('r', 4)
            .style('stroke-width', 0.5);

        // listener for points interactivity
        vis.points
            .on("mouseover", function (event, d) {
                d3.select("#tooltip")
                .style("display", "block")
                .style("left", event.pageX + vis.config.tooltipPadding + "px")
                .style("top", event.pageY + vis.config.tooltipPadding + "px").html(`
                    <div class="tooltip-title">${d.name}</div>
                `);

                // Change opacity of all points with actor in the id
                d3.select(this).classed('hovered-point');

                vis.lines.filter(line => line.actor === d.name || line.collab === d.name)
                .classed('hovered-line', true)
                .attr("stroke-width", d => vis.lineWidthScale(d.count) + 1);
            })
            .on("mouseleave", function (event, d) {
                d3.select("#tooltip").style("display", "none");
                d3.select(this).classed('hovered-point', false);
                vis.lines.classed('hovered-line', false)
                .attr("stroke-width", d => vis.lineWidthScale(d.count));
            })
            .on('click', function (event, d) {
                event.stopPropagation()
                updateGlobalActorSelection(d.name)
            });

 
        // draw annotation lines
        vis.annotations = vis.chart.selectAll('.annotation')
            .data(vis.genreAnnotations)
            .join('path')
            .attr('class', 'annotation')
            .attr("d", d => vis.annotationPath(d))
            .attr('fill', "none")
            .style('stroke', "black")
            .append('text')
            .text(d => d[0]);

        // add annotation labels
        vis.annotationLabels = vis.chart.selectAll('.label')
            .data(vis.genreAnnotations)
            .join('text')
            .attr('class', '.label')
            .text(d => d[0])
            .attr('fill', "black")
            .attr('x', d => vis.getX(vis.actorNamesIndex.indexOf(d[1]) + Math.floor(d[2]/2), vis.config.radius + 20))
            .attr('y', d => vis.getY(vis.actorNamesIndex.indexOf(d[1]) + Math.floor(d[2]/2), vis.config.radius + 20) + 5)
            .attr('text-anchor', d => {
                if (vis.getX(vis.actorNamesIndex.indexOf(d[1]) + Math.floor(d[2]/2), vis.config.radius + 20) < (vis.config.width / 2)) {
                    return "end";
                } else {
                    return "start";
                }})
            .style('font-size', 10);     
    }

// create the path for each annotation
   annotationPath(data) {
    let vis = this;
    const index = vis.actorNamesIndex.indexOf(data[1]) - 0.5;
    const startX = vis.getX(index, vis.config.radius + 5);
    const startY = vis.getY(index, vis.config.radius + 5);
    const arcStartX = vis.getX(index, vis.config.radius + 15);
    const arcStartY = vis.getY(index, vis.config.radius + 15);
    const arcEndX = vis.getX(index + data[2], vis.config.radius + 15);
    const arcEndY = vis.getY(index + data [2], vis.config.radius + 15);
    const endX = vis.getX(index + data[2], vis.config.radius + 5);
    const endY = vis.getY(index + data[2], vis.config.radius + 5);

    return `M ${startX} ${startY} L ${arcStartX} ${arcStartY} A ${vis.config.radius + 15} ${vis.config.radius + 15} 0 0 0 ${arcEndX} ${arcEndY} L ${endX} ${endY}`;
  }

  // create the bezier curve path for each collaboration
  linePath(data) {
    let vis = this;
    const indexActor = vis.actorNamesIndex.indexOf(data.actor);
    const indexCollab = vis.actorNamesIndex.indexOf(data.collab);

    const startX = vis.getX(indexActor, vis.config.radius);
    const startY = vis.getY(indexActor, vis.config.radius);
    const endX = vis.getX(indexCollab, vis.config.radius);
    const endY = vis.getY(indexCollab, vis.config.radius);

    return `M ${startX} ${startY} C ${data.actorAnchorX} ${data.actorAnchorY} ${data.collabAnchorX} ${data.collabAnchorY} ${endX} ${endY}`;
  }

  renderNetwork(name) {
    let vis = this;
    // Determine if selected point is currently selected
    const selectedPoint = vis.points.filter(point => point.name === name)

    // If true, remove all selections
    if (selectedPoint === null) {
        d3.selectAll('.selected-parent').classed('selected-parent', false)
        d3.selectAll('.selected-child').classed('selected-child', false)
        d3.selectAll('.selected-line').classed('selected-line', false)
    } else {

    // Remove previously selected items
    d3.selectAll('.selected-parent').classed('selected-parent', false)
    d3.selectAll('.selected-child').classed('selected-child', false)
    d3.selectAll('.selected-line').classed('selected-line', false)


    selectedPoint.classed('selected-parent', !selectedPoint.classed('selected-parent'));

    // Identify connected lines and points and add classes for their color
    const connectedLines = vis.lines.filter(line => line.actor === name || line.collab === name);
    connectedLines.classed('selected-line', !connectedLines.classed('selected-line'));

    const connectedPoints = vis.points.filter(point => {
        return connectedLines.data().some(line => line.actor === point.name || line.collab === point.name);
      });
    connectedPoints.classed('selected-child', !connectedPoints.classed('selected-child'));
    }
  }
}