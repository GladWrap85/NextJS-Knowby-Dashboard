import ActiveKnowbys from "@/components/Cards/ActiveKnowbys"
import Calendar from "@/components/Cards/Calendar"
import { DataTableDemo } from "@/components/Cards/DataTable"
import General from "@/components/Cards/General"
import Lines from "@/components/Cards/Line"
import MonthlyViews from "@/components/Cards/MonthlyViews"
import { TableDemo } from "@/components/Cards/Table"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import LineWithDropdown from "@/components/Cards/Linev2"

export default function Home() {
    return <div className="grid gap-[32px]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-[32px]">
        <LineWithDropdown />
        <div className="grid gap-[32px]">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[32px] h-[234px]">
            <Card>
              <CardHeader>
                <CardTitle>Active Knowbys</CardTitle>
                <CardDescription>Number of currently active knowbys.</CardDescription>
              </CardHeader>
              <CardContent>
                <ActiveKnowbys />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Monthly Views</CardTitle>
                <CardDescription>Number of currently active knowbys.</CardDescription>
              </CardHeader>
              <CardContent>
                <MonthlyViews />
              </CardContent>
            </Card>
          </div>
          <Calendar />
        </div>
      </div>
      <div className="grid lg:grid-cols-3 gap-[32px] lg:h-[300px] mb-[32px]">
        <Lines />
        <Card className="overflow-y-scroll">
          <CardHeader>
            <CardTitle>Highest Performing Employees</CardTitle>
            <CardDescription>These are the employees with the greatest completions.</CardDescription>
          </CardHeader>
          <div className="px-4 max-h-[350px]">
            <TableDemo />
          </div>
        </Card>
        <Card className="overflow-y-scroll">
          <CardHeader>
            <CardTitle>Users</CardTitle>
            <CardDescription>These are the users of the month.</CardDescription>
          </CardHeader>
          <div className="px-4">
            <DataTableDemo />
          </div>
        </Card>
      </div>
    </div>
};