'use strict';

var SHIFT_START_DATE = $.fullCalendar.moment('2016-10-24');
var SHIFT_START_DAY = 1;
var SHIFT_DURATION = moment.duration(1, 'weeks');

var ONCALLS = [
    {name: "Wang Kai", color: "red"},
    {name: "Yuan Fei", color: "green"}
];

var getOncall = function (dt) {
    return ONCALLS[Math.floor(dt.diff(SHIFT_START_DATE, 'days') / 7) % ONCALLS.length];
};

var buildEvent = function (start, end, shiftStart) {
    if (shiftStart.isBefore(SHIFT_START_DATE)) {
        return null;
    }

    var eventStart = moment.max(shiftStart, start).clone();
    var eventEnd = moment.min(shiftStart.clone().add(SHIFT_DURATION), end).clone();

    if (!eventStart.isBefore(eventEnd)) {
        return null;
    }

    var oncall = getOncall(shiftStart);

    return {title: oncall.name, start: eventStart, end: eventEnd, color: oncall.color};
};

$(document).ready(function () {
    $('#calendar').fullCalendar({
        header: {
            left: 'prev today',
            center: 'title',
            right: 'next'
        },
        fixedWeekCount: false,
        events: function (start, end, timezone, callback) {
            var events = [];

            var shiftStart = start.clone().day(SHIFT_START_DAY - 7);

            while (shiftStart.isBefore(end)) {
                var event = buildEvent(start, end, shiftStart);
                if (event != null) {
                    events.push(event);
                }

                shiftStart.add(SHIFT_DURATION);
            }

            callback(events);
        }
    })
});