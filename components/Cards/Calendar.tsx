'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '../ui/card';

// install (please try to align the version of installed @nivo packages)
// yarn add @nivo/calendar
import { ResponsiveTimeRange } from '@nivo/calendar'

// make sure parent container have a defined height when using
// responsive component, otherwise height will be 0 and
// no chart will be rendered.
// website examples showcase many properties,
// you'll often use just a few of them.
const MyResponsiveTimeRange = ({ data /* see data tab */ }: any) => {
  return <ResponsiveTimeRange
    data={data}
    from="2023-01-01"
    to="2023-12-12"
    emptyColor="#eeeeee"
    colors={['#61cdbb', '#97e3d5', '#e8c1a0', '#f47560']}
    dayBorderWidth={2}
    dayBorderColor="#ffffff"
    margin={{ top: 20, right: 0, bottom: 0, left: 0 }}
    />
}

export default function Calendar() {

  function generateDataForYear2023() {
    const data = [];
    const startDate = new Date("2023-01-01");
    const endDate = new Date("2023-12-31")

    while (startDate <= endDate) {
      const value = Math.floor(Math.random() * 301); // Random value between 0 and 300
      const formattedDate = startDate.toISOString().split('T')[0];

      data.push({
        "value": value,
        "day": formattedDate
      });

      startDate.setDate(startDate.getDate() + 1);
    }

    return data;
  }

  //Usage:
  const dataArray = generateDataForYear2023();

  return <Card>
    <CardHeader>
      <CardTitle>Calendar</CardTitle>
        <CardDescription>These are the numbers of this year.</CardDescription>
    </CardHeader>
    <CardContent className="h-[100px] flex items-center w-full">
      <MyResponsiveTimeRange data={dataArray} />
    </CardContent>
  </Card>;
}