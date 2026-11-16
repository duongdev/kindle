local Blitbuffer = require("ffi/blitbuffer")
local CenterContainer = require("ui/widget/container/centercontainer")
local Device = require("device")
local Dispatcher = require("dispatcher")
local Font = require("ui/font")
local FrameContainer = require("ui/widget/container/framecontainer")
local Geom = require("ui/geometry")
local GestureRange = require("ui/gesturerange")
local InputContainer = require("ui/widget/container/inputcontainer")
local TextWidget = require("ui/widget/textwidget")
local UIManager = require("ui/uimanager")
local VerticalGroup = require("ui/widget/verticalgroup")
local VerticalSpan = require("ui/widget/verticalspan")
local WidgetContainer = require("ui/widget/container/widgetcontainer")
local _ = require("gettext")
local Screen = Device.screen

local DashboardScreen = InputContainer:extend{
    covers_fullscreen = true,
    taps = 0,
}

function DashboardScreen:init()
    self.dimen = Geom:new{ x = 0, y = 0, w = Screen:getWidth(), h = Screen:getHeight() }
    self.ges_events = {
        Tap = { GestureRange:new{ ges = "tap", range = self.dimen } },
        Swipe = { GestureRange:new{ ges = "swipe", range = self.dimen } },
    }
    self[1] = self:render()
end

function DashboardScreen:render()
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
                VerticalSpan:new{ width = Screen:scaleBySize(48) },
                line(_("Taps: ") .. self.taps, 24),
                line(_("Tap to refresh. Swipe to close."), 18),
            },
        },
    }
end

function DashboardScreen:onShow()
    UIManager:setDirty(self, "full")
end

function DashboardScreen:onTap()
    self.taps = self.taps + 1
    self[1] = self:render()
    UIManager:setDirty(self, "ui")
    return true
end

function DashboardScreen:onSwipe()
    UIManager:close(self, "full")
    return true
end

local Dashboard = WidgetContainer:extend{
    name = "dashboard",
}

function Dashboard:init()
    Dispatcher:registerAction("dashboard_show", {
        category = "none", event = "ShowDashboard", title = _("Dashboard"), general = true,
    })
    self.ui.menu:registerToMainMenu(self)
    if os.getenv("DASHBOARD_AUTOSTART") and not Dashboard.autostarted then
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
