import Image from "next/image";
import Link from "next/link";

export default function NewListing() {
    return (
        <main>
            <section className="pt-16 px-8 flex flex-col items-center justify-center text-center">
                <Image src="/images/firescreener-mock.png" alt="Firescreener data mockup" width={400} height={400} className="pb-4 w-96 h-auto" />
                <h1 className="font-bold text-3xl md:text-5xl">NEW LISTING</h1>
                <p className="text-lg md:text-xl pb-8">Want to get your project listed on FireScreener quicker?</p>
                <Link href="https://wa.me/2348161670217" className="bg-orange-500 px-8 py-2 rounded-xl font-semibold text-lg">Contact us here</Link>
                <Link href="mail:to(team@firescreener.com)" className="border border-orange-500  p-3  rounded-md mt-4 flex flex-col md:flex-row md:gap-2 justify-center items-center">
                    <span>Contact us through mail:</span>
                    <span className="text-lg font-semibold">team@firescreener.com</span>
                </Link>


            </section>
        </main>
    );
}