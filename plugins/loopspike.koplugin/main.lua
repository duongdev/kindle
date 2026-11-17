-- Throwaway spike for issue 06. See docs/procedures/loop-spike.md.
local Blitbuffer = require("ffi/blitbuffer")
local CenterContainer = require("ui/widget/container/centercontainer")
local DataStorage = require("datastorage")
local Device = require("device")
local Font = require("ui/font")
local FrameContainer = require("ui/widget/container/framecontainer")
local Geom = require("ui/geometry")
local GestureRange = require("ui/gesturerange")
local InputContainer = require("ui/widget/container/inputcontainer")
local NetworkMgr = require("ui/network/manager")
local TextWidget = require("ui/widget/textwidget")
local UIManager = require("ui/uimanager")
local VerticalGroup = require("ui/widget/verticalgroup")
local VerticalSpan = require("ui/widget/verticalspan")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local logger = require("logger")
local time = require("ui/time")
local _ = require("gettext")
local Screen = Device.screen

-- The emulator has no RTC or suspend, so it runs the same rules 10 times faster on a timer.
local SCALE = Device.wakeup_mgr and 1 or 0.1
-- Wi-Fi first: a sync also redraws the calendar and the clock.
local RULES = {
    { id = "wifi", every = 1200 * SCALE },
    { id = "calendar", every = 600 * SCALE },
    { id = "clock", every = 60 * SCALE },
}
local RUN_FOR = 3600 * SCALE
-- powerd can fire the alarm up to 10 s early, and KOReader runs the task 15 s after the wake.
local SLACK = 30 * SCALE
local WIFI_TIMEOUT = 45
local LOG_PATH = Device:isKindle() and "/mnt/us/loopspike.log" or DataStorage:getDataDir() .. "/loopspike.log"

local function log(msg)
    local powerd_state = Device.powerd.getPowerdState and Device.powerd:getPowerdState() or "n/a"
    local line = string.format("%s %s | powerd=%s batt=%s wifi=%s conn=%s",
        os.date("%F %T"), msg, tostring(powerd_state),
        tostring(Device.powerd:getCapacity()), tostring(NetworkMgr:isWifiOn()), tostring(NetworkMgr:isConnected()))
    logger.info("LoopSpike:", line)
    local f = io.open(LOG_PATH, "a")
    if f then
        f:write(line, "\n")
        f:close()
    end
end

-- First wall-clock multiple of `every` at or after t, so a 1 min rule lands on :00.
local function alignUp(t, every)
    return math.ceil(t / every) * every
end

-- NetworkMgr:turnOnWifi shows a scan popup on Kindle; wifid reconnects to the saved profile on its own.
local function wifiOn()
    if Device:isKindle() then
        os.execute("lipc-set-prop -i com.lab126.cmd wirelessEnable 1; lipc-set-prop -i com.lab126.wifid enable 1")
    end
end

-- NetworkMgr:turnOffWifi on Kindle also clears wirelessEnable, which is airplane mode.
local function wifiOff()
    if Device:isKindle() then
        os.execute("lipc-set-prop -i com.lab126.wifid enable 0")
    else
        NetworkMgr:turnOffWifi()
    end
end

local SpikeScreen = InputContainer:extend{
    covers_fullscreen = true,
    state = nil,
    on_close = nil,
}

function SpikeScreen:init()
    self.dimen = Geom:new{ x = 0, y = 0, w = Screen:getWidth(), h = Screen:getHeight() }
    self.ges_events = {
        Swipe = { GestureRange:new{ ges = "swipe", range = self.dimen } },
    }
    self[1] = self:render()
end

function SpikeScreen:render()
    local s = self.state
    local line = function(text, size)
        return TextWidget:new{ text = text, face = Font:getFace("cfont", size) }
    end
    return FrameContainer:new{
        width = self.dimen.w,
        height = self.dimen.h,
        background = Blitbuffer.COLOR_WHITE,
        bordersize = 0,
        padding = 0,
        CenterContainer:new{
            dimen = self.dimen,
            VerticalGroup:new{
                line(os.date("%H:%M"), 120),
                line(os.date("%A, %d %B %Y"), 32),
                VerticalSpan:new{ width = Screen:scaleBySize(40) },
                line("Calendar: " .. (s.calendar_at or "-"), 22),
                line("Data: " .. (s.data or "-"), 22),
                line(string.format("Runs: clock %d, calendar %d, wifi %d",
                    s.runs.clock, s.runs.calendar, s.runs.wifi), 22),
                line(string.format("Battery %s%% (start %s%%)",
                    tostring(Device.powerd:getCapacity()), tostring(s.batt_start)), 22),
                VerticalSpan:new{ width = Screen:scaleBySize(24) },
                line(_("Loop spike. Swipe to close."), 16),
            },
        },
    }
end

function SpikeScreen:update(mode)
    self[1] = self:render()
    UIManager:setDirty(self, mode)
end

function SpikeScreen:onShow()
    UIManager:setDirty(self, "full")
end

function SpikeScreen:onSwipe()
    UIManager:close(self, "full")
    return true
end

function SpikeScreen:onCloseWidget()
    if self.on_close then self.on_close() end
end

local LoopSpike = WidgetContainer:extend{
    name = "loopspike",
}

function LoopSpike:init()
    self.ui.menu:registerToMainMenu(self)
    if os.getenv("LOOPSPIKE_AUTOSTART") and not LoopSpike.autostarted then
        LoopSpike.autostarted = true
        UIManager:nextTick(function() self:start() end)
    end
end

function LoopSpike:addToMainMenu(menu_items)
    menu_items.loopspike = {
        text = _("Loop spike"),
        sorting_hint = "more_tools",
        sub_item_table = {
            { text = _("Start"), callback = function() self:start() end },
            { text = _("Stop"), callback = function() self:stop() end },
        },
    }
end

function LoopSpike:start()
    self:stop(true)
    local now = os.time()
    self.stop_at = now + RUN_FOR
    self.next_due = {}
    self.state = { runs = { clock = 0, calendar = 0, wifi = 0 }, batt_start = Device.powerd:getCapacity() }
    self.task = function() self:onWake() end
    self.screen = SpikeScreen:new{
        state = self.state,
        on_close = function() self.screen = nil end,
    }
    UIManager:show(self.screen)
    log(string.format("start scale=%s run_for=%ds", SCALE, RUN_FOR))
    for _, rule in ipairs(RULES) do
        self.next_due[rule.id] = now
    end
    self:onWake(function()
        if Device.wakeup_mgr then
            log("suspend request")
            UIManager:suspend()
        end
    end)
end

function LoopSpike:stop(quiet)
    if not self.task then return end
    self:unscheduleTask()
    self.task = nil
    if not quiet then log("stop") end
end

function LoopSpike:unscheduleTask()
    if Device.wakeup_mgr then
        Device.wakeup_mgr:removeTasks(nil, self.task)
    end
    UIManager:unschedule(self.task)
end

-- One alarm for the earliest due rule. Rules that fall due together share one wake.
function LoopSpike:schedule()
    local now = os.time()
    if now >= self.stop_at then
        log("done")
        self.task = nil
        return
    end
    local next_at = math.huge
    for _, rule in ipairs(RULES) do
        next_at = math.min(next_at, self.next_due[rule.id])
    end
    local delay = math.max(5 * SCALE, next_at - now)
    self:unscheduleTask()
    if Device.wakeup_mgr then
        Device.wakeup_mgr:addTask(delay, self.task)
    else
        UIManager:scheduleIn(delay, self.task)
    end
    self.expected = now + delay
end

function LoopSpike:onWake(after)
    local now = os.time()
    local due = {}
    local names = {}
    for _, rule in ipairs(RULES) do
        if now >= self.next_due[rule.id] - SLACK then
            due[rule.id] = true
            table.insert(names, rule.id)
            self.state.runs[rule.id] = self.state.runs[rule.id] + 1
            self.next_due[rule.id] = alignUp(now + SLACK, rule.every)
        end
    end
    log(string.format("wake due=%s late=%ss", table.concat(names, ","),
        self.expected and tostring(now - self.expected) or "-"))
    local finish = function() self:finish(due, after) end
    if due.wifi then
        self:sync(finish)
    else
        finish()
    end
end

function LoopSpike:sync(done)
    local t0 = time.now()
    wifiOn()
    local function poll()
        local elapsed = time.to_s(time.since(t0))
        if NetworkMgr:isConnected() then
            log(string.format("wifi up %.1fs", elapsed))
            self:fetch(elapsed)
            return done()
        end
        if elapsed > WIFI_TIMEOUT then
            log("wifi timeout")
            self.state.data = os.date("%H:%M") .. " wifi timeout"
            return done()
        end
        UIManager:scheduleIn(1, poll)
    end
    poll()
end

function LoopSpike:fetch(wifi_s)
    local http = require("socket.http")
    local socketutil = require("socketutil")
    local t0 = time.now()
    socketutil:set_timeout(10, 20)
    local ok, __, code = pcall(http.request, { url = "http://example.com/", method = "HEAD" })
    socketutil:reset_timeout()
    log(string.format("fetch %.1fs ok=%s code=%s", time.to_s(time.since(t0)), tostring(ok), tostring(code)))
    self.state.data = string.format("%s (wifi %.0fs, http %s)", os.date("%H:%M"), wifi_s, tostring(code))
end

function LoopSpike:finish(due, after)
    if due.wifi or due.calendar then
        self.state.calendar_at = os.date("%H:%M")
    end
    -- Clock-only ticks use a fast partial refresh; heavier ticks flash to clear ghosting.
    local mode = (due.wifi or due.calendar) and "full" or "ui"
    if self.screen then self.screen:update(mode) end
    UIManager:scheduleIn(2, function()
        if due.wifi then wifiOff() end
        log("redrawn " .. mode)
        if not self.task then return end
        self:schedule()
        if after then after() end
    end)
end

-- A power-button sleep can leave our alarm in the past, and powerd then drops it. Re-arm on every sleep.
function LoopSpike:onSuspend()
    if not self.task then return end
    log("event Suspend")
    self:schedule()
end

-- KOReader sends Resume only for power-button and cover wakes; RTC wakes stay in powerd's screenSaver state.
function LoopSpike:onResume()
    if not self.task then return end
    log("event Resume (manual wake)")
    -- The user is about to use the device: give back Wi-Fi and clear the ghosting left by partial clock redraws.
    wifiOn()
    if self.screen then
        self.screen:update("full")
    else
        UIManager:setDirty("all", "full")
    end
end

return LoopSpike
