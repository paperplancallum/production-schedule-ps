import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function UIDemo() {
  return (
    <div className="container mx-auto p-8">
      <h1 className="text-4xl font-bold mb-8">shadcn/ui Components Demo</h1>
      
      <div className="space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4">Buttons</h2>
          <div className="flex gap-4 flex-wrap">
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="link">Link</Button>
          </div>
        </section>

        <section>
          <h2 className="text-2xl font-semibold mb-4">Cards</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Card Title</CardTitle>
                <CardDescription>Card description goes here</CardDescription>
              </CardHeader>
              <CardContent>
                <p>This is the card content. You can put any content here.</p>
              </CardContent>
              <CardFooter>
                <Button className="w-full">Action</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Another Card</CardTitle>
                <CardDescription>With different content</CardDescription>
              </CardHeader>
              <CardContent>
                <p>shadcn/ui provides beautiful, accessible components.</p>
              </CardContent>
              <CardFooter className="flex gap-2">
                <Button variant="outline">Cancel</Button>
                <Button>Confirm</Button>
              </CardFooter>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Third Card</CardTitle>
                <CardDescription>Example card component</CardDescription>
              </CardHeader>
              <CardContent>
                <p>Ready to use in your production schedule app!</p>
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </div>
  )
}