-- Interactive dashboard viewer (issue 10, ADR 0002). Shows the server's screen PNGs full screen and maps
-- taps to the tap regions the server returns with each screen. All layout lives on the server.
local Blitbuffer = require("ffi/blitbuffer")
local DataStorage = require("datastorage")
local Device = require("device")
local Dispatcher = require("dispatcher")
local Geom = require("ui/geometry")
local GestureRange = require("ui/gesturerange")
local ImageWidget = require("ui/widget/imagewidget")
local InputContainer = require("ui/widget/container/inputcontainer")
local Font = require("ui/font")
local NetworkMgr = require("ui/network/manager")
local CenterContainer = require("ui/widget/container/centercontainer")
local TextWidget = require("ui/widget/textwidget")
local lfs = require("libs/libkoreader-lfs")
local UIManager = require("ui/uimanager")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local json = require("json")
local logger = require("logger")
local ltn12 = require("ltn12")
local _ = require("gettext")
local Screen = Device.screen

local SERVER = os.getenv("DASHBOARD_SERVER") or "http://192.168.1.102:10060"
local SCREENS = { "home", "agenda", "nha" }
local DESIGN_W, DESIGN_H = 1264, 1680
-- Full (flashing) refresh every N clock ticks clears the ghosting that partial refreshes leave (refresh.md).
local FULL_EVERY = 10

local function http()
    local socketutil = require("socketutil")
    socketutil:set_timeout(5, 15)
    return require("socket.http"), socketutil
end

local function query()
    local batt = Device:hasBattery() and Device.powerd:getCapacity() or ""
    local charging = Device:hasBattery() and Device.powerd:isCharging() and 1 or 0
    local wifi = NetworkMgr:isWifiOn() and 1 or 0
    return string.format("?batt=%s&charging=%d&wifi=%d", tostring(batt), charging, wifi)
end

local function get(path, sink)
    local h, socketutil = http()
    local ok, code = h.request{ url = SERVER .. path, sink = sink }
    socketutil:reset_timeout()
    return ok == 1 and code == 200, code
end

local DashboardScreen = InputContainer:extend{
    covers_fullscreen = true,
    index = 1,
    ticks = 0,
}

function DashboardScreen:init()
    self.dimen = Geom:new{ x = 0, y = 0, w = Screen:getWidth(), h = Screen:getHeight() }
    self.scale = self.dimen.w / DESIGN_W
    self.cache_dir = DataStorage:getDataDir() .. "/cache"
    self.regions_by = {}
    self.ges_events = {
        Tap = { GestureRange:new{ ges = "tap", range = self.dimen } },
        Swipe = { GestureRange:new{ ges = "swipe", range = self.dimen } },
    }
    if Device:hasKeys() then
        self.key_events = {
            NextScreen = { { Device.input.group.PgFwd } },
            PrevScreen = { { Device.input.group.PgBack } },
        }
    end
    self.regions = {}
    self:load("full")
    UIManager:nextTick(function() self:prefetch() end)
end

function DashboardScreen:pngFor(name)
    return self.cache_dir .. "/dashboard-" .. name .. ".png"
end

function DashboardScreen:name()
    return SCREENS[self.index]
end

-- Download one screen's PNG and tap regions into the cache. On failure the last cached copy stays.
function DashboardScreen:fetch(name)
    local png = self:pngFor(name)
    local f = io.open(png .. ".new", "wb")
    local ok, code = get("/screen/" .. name .. ".png" .. query(), ltn12.sink.file(f))
    if not ok then
        logger.warn("dashboard: fetch failed", name, code)
        os.remove(png .. ".new")
        return false
    end
    os.rename(png .. ".new", png)
    local body = {}
    if get("/screen/" .. name .. ".json", ltn12.sink.table(body)) then
        local decoded = json.decode(table.concat(body))
        self.regions_by[name] = decoded and decoded.regions or {}
    end
    return true
end

-- Show the cached image of the current screen.
function DashboardScreen:display(refresh)
    local name = self:name()
    local png = self:pngFor(name)
    if self[1] then self[1]:free() end
    if not lfs.attributes(png, "mode") then
        self[1] = CenterContainer:new{
            dimen = self.dimen,
            TextWidget:new{ text = _("Không kết nối được máy chủ dashboard"), face = Font:getFace("cfont", 28) },
        }
        self.regions = {}
        UIManager:setDirty(self, "full")
        return
    end
    self.regions = self.regions_by[name] or {}
    self[1] = ImageWidget:new{
        file = png,
        file_do_cache = false,
        width = self.dimen.w,
        height = self.dimen.h,
        scale_factor = 0,
    }
    UIManager:setDirty(self, refresh or "ui")
end

function DashboardScreen:load(refresh)
    logger.info("dashboard: load", self:name(), refresh)
    self:fetch(self:name())
    self:display(refresh)
    self:scheduleTick()
end

-- Keep the screens on either side warm, so a swipe or button press shows at once.
function DashboardScreen:prefetch()
    for _, d in ipairs({ 1, -1 }) do
        local name = SCREENS[(self.index + d - 1) % #SCREENS + 1]
        self:fetch(name)
    end
end

-- Redraw at the next minute boundary, so the clock flips on :00.
function DashboardScreen:scheduleTick()
    UIManager:unschedule(self.tick_fn)
    self.tick_fn = self.tick_fn or function() self:onTick() end
    UIManager:scheduleIn(60 - (os.time() % 60) + 1, self.tick_fn)
end

function DashboardScreen:onTick()
    self.ticks = self.ticks + 1
    self:load(self.ticks % FULL_EVERY == 0 and "full" or "ui")
    UIManager:nextTick(function() self:prefetch() end)
end

function DashboardScreen:regionAt(x, y)
    local dx, dy = x / self.scale, y / self.scale
    for _, r in ipairs(self.regions) do
        if dx >= r.x and dx < r.x + r.w and dy >= r.y and dy < r.y + r.h then return r end
    end
end

-- Pending look (states.md): a thick frame on the tapped region right away, before the network call.
function DashboardScreen:markPending(r)
    local s = self.scale
    local rect = Geom:new{ x = math.floor(r.x * s), y = math.floor(r.y * s), w = math.floor(r.w * s), h = math.floor(r.h * s) }
    local bw = math.max(3, math.floor(6 * s))
    self.pending = rect
    self.pending_border = bw
    UIManager:setDirty(self, "fast", rect)
    UIManager:forceRePaint()
end

function DashboardScreen:paintTo(bb, x, y)
    InputContainer.paintTo(self, bb, x, y)
    if self.pending then
        local r, bw = self.pending, self.pending_border
        bb:paintBorder(r.x, r.y, r.w, r.h, bw, Blitbuffer.COLOR_BLACK)
    end
end

function DashboardScreen:onTap(_, ges)
    local r = self:regionAt(ges.pos.x, ges.pos.y)
    if not r then return true end
    if r.id == "nav.agenda" then return self:show(2) end
    if r.id == "sync.now" then return self:load("full") or true end
    self:markPending(r)
    local h, socketutil = http()
    local ok, code = h.request{
        url = SERVER .. "/action/" .. r.id,
        method = "POST",
        headers = { ["Content-Length"] = "0" },
        source = ltn12.source.empty(),
    }
    socketutil:reset_timeout()
    if ok ~= 1 or (code ~= 204 and code ~= 429) then logger.warn("dashboard: action failed", r.id, code) end
    self.pending = nil
    self:load("ui")
    return true
end

-- Switch at once from the cache with a non-flashing refresh, then fetch fresh data and the new neighbours.
function DashboardScreen:show(index)
    logger.info("dashboard: show", self.index, "->", index)
    self.index = (index - 1) % #SCREENS + 1
    local cached = lfs.attributes(self:pngFor(self:name()), "mode") ~= nil
    if cached then
        self:display("ui")
        UIManager:forceRePaint()
    end
    UIManager:nextTick(function()
        self:load("ui")
        self:prefetch()
    end)
    return true
end

function DashboardScreen:onKeyPress(key)
    logger.info("dashboard: key", tostring(key), "rotation", Screen:getRotationMode())
    return InputContainer.onKeyPress(self, key)
end

function DashboardScreen:onSwipe(_, ges)
    logger.info("dashboard: swipe", ges.direction)
    if ges.direction == "west" then return self:show(self.index + 1) end
    if ges.direction == "east" then return self:show(self.index - 1) end
    if ges.direction == "south" then
        UIManager:close(self, "full")
        return true
    end
    return true
end

function DashboardScreen:onNextScreen(_, key)
    logger.info("dashboard: key next", key and tostring(key))
    return self:show(self.index + 1)
end
function DashboardScreen:onPrevScreen(_, key)
    logger.info("dashboard: key prev", key and tostring(key))
    return self:show(self.index - 1)
end

-- Home is the frame the owner sees first after a wake (screens.md).
function DashboardScreen:onSuspend()
    logger.info("dashboard: suspend")
    UIManager:unschedule(self.tick_fn)
    self.index = 1
end

function DashboardScreen:onResume()
    logger.info("dashboard: resume")
    self:load("full")
end

function DashboardScreen:onCloseWidget()
    UIManager:unschedule(self.tick_fn)
    if self[1] then self[1]:free() end
end

local Dashboard = WidgetContainer:extend{
    name = "dashboard",
}

function Dashboard:init()
    Dispatcher:registerAction("dashboard_show", {
        category = "none", event = "ShowDashboard", title = _("Dashboard"), general = true,
    })
    self.ui.menu:registerToMainMenu(self)
    -- The stock-home launcher (kindle/Dashboard.sh) leaves this flag; env vars may not pass through kpm.
    local flag = "/tmp/dashboard.autostart"
    local from_launcher = lfs.attributes(flag, "mode") ~= nil
    if from_launcher then os.remove(flag) end
    if (from_launcher or os.getenv("DASHBOARD_AUTOSTART")) and not Dashboard.autostarted then
        Dashboard.autostarted = true
        UIManager:nextTick(function() self:onShowDashboard() end)
    end
end

function Dashboard:addToMainMenu(menu_items)
    menu_items.dashboard = {
        text = _("Dashboard"),
        sorting_hint = "more_tools",
        callback = function() self:onShowDashboard() end,
    }
end

function Dashboard:onShowDashboard()
    UIManager:show(DashboardScreen:new{})
    return true
end

return Dashboard
